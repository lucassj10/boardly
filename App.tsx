import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Board from './components/Board';
import Toolbar from './components/Toolbar';
import { 
  ToolType, 
  BoardElement, 
  ShapeType, 
  PathElement, 
  ShapeElement,
  Point,
  TextElement,
  ImageElement,
  LineElement
} from './types';
import { DEFAULT_COLOR, DEFAULT_STROKE_WIDTH } from './constants';
import { getBoundingBox, detectShape } from './utils/geometry';

function App() {
  // State
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [history, setHistory] = useState<BoardElement[][]>([]);
  const [historyStep, setHistoryStep] = useState<number>(0);
  
  const [currentTool, setCurrentTool] = useState<ToolType>(ToolType.PEN);
  const [currentColor, setCurrentColor] = useState<string>(DEFAULT_COLOR);
  const [currentWidth, setCurrentWidth] = useState<number>(DEFAULT_STROKE_WIDTH);
  
  const [currentElement, setCurrentElement] = useState<BoardElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  
  // Undo/Redo Logic
  const saveToHistory = useCallback((newElements: BoardElement[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    setElements(newElements);
  }, [history, historyStep]);

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(prev => prev - 1);
      setElements(history[historyStep - 1]);
    } else if (historyStep === 0) {
       setHistoryStep(-1);
       setElements([]);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(prev => prev + 1);
      setElements(history[historyStep + 1]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyStep]);

  // Image Paste Logic
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                const img = new Image();
                img.onload = () => {
                    const maxWidth = 300;
                    const scale = maxWidth / img.width;
                    const width = maxWidth;
                    const height = img.height * scale;
                    
                    const newImage: ImageElement = {
                        id: uuidv4(),
                        type: ShapeType.IMAGE,
                        x: window.innerWidth / 2 - width / 2,
                        y: window.innerHeight / 2 - height / 2,
                        width: width,
                        height: height,
                        color: 'transparent',
                        strokeWidth: 0,
                        dataUrl: event.target!.result as string
                    };
                    saveToHistory([...elements, newImage]);
                }
                img.src = event.target.result as string;
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [elements, saveToHistory]);


  // Pointer Events
  const getPoint = (e: React.PointerEvent): Point => {
    return { x: e.clientX, y: e.clientY };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const startPoint = getPoint(e);

    if (currentTool === ToolType.PEN || currentTool === ToolType.ERASER) {
      const isEraser = currentTool === ToolType.ERASER;
      const newEl: PathElement = {
        id: uuidv4(),
        type: isEraser ? ShapeType.ERASER : ShapeType.FREEHAND,
        points: [startPoint],
        color: isEraser ? '#000000' : currentColor,
        strokeWidth: isEraser ? 30 : currentWidth
      };
      setCurrentElement(newEl);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const currentPoint = getPoint(e);

    if (currentElement) {
       if (currentElement.type === ShapeType.FREEHAND || currentElement.type === ShapeType.ERASER) {
        const pathEl = currentElement as PathElement;
        setCurrentElement({
          ...pathEl,
          points: [...pathEl.points, currentPoint]
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!isDrawing) return;

    setIsDrawing(false);
    
    if (!currentElement) return;

    let finalizedElement: BoardElement = currentElement;
    
    // Auto-correct only for PEN (Freehand), not ERASER
    if (currentElement.type === ShapeType.FREEHAND) {
        const pathEl = currentElement as PathElement;
        const shape = detectShape(pathEl.points);
        
        if (shape) {
            const box = getBoundingBox(pathEl.points);
            
            if (shape.type === ShapeType.LINE) {
                const lineEl: LineElement = {
                    id: currentElement.id,
                    type: ShapeType.LINE,
                    color: currentElement.color,
                    strokeWidth: currentElement.strokeWidth,
                    start: pathEl.points[0],
                    end: pathEl.points[pathEl.points.length - 1]
                };
                finalizedElement = lineEl;
            } else if ([ShapeType.SQUARE, ShapeType.CIRCLE, ShapeType.TRIANGLE].includes(shape.type)) {
                const shapeEl: ShapeElement = {
                    id: currentElement.id,
                    type: shape.type as (ShapeType.SQUARE | ShapeType.CIRCLE | ShapeType.TRIANGLE),
                    color: currentElement.color,
                    strokeWidth: currentElement.strokeWidth,
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height
                };
                finalizedElement = shapeEl;
            }
        }
    }

    saveToHistory([...elements, finalizedElement]);
    setCurrentElement(null);
  };

  const handleTextSubmit = (text: string, x: number, y: number) => {
    if (!text.trim()) return;
    const textEl: TextElement = {
        id: uuidv4(),
        type: ShapeType.TEXT,
        x,
        y,
        text,
        fontSize: currentWidth,
        color: currentColor,
        strokeWidth: 1
    };
    saveToHistory([...elements, textEl]);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* App Name */}
      <div className="absolute top-8 left-8 z-40 select-none">
        <h1 className="text-white text-4xl font-bold font-[Kalam] tracking-wider opacity-80">Boardly</h1>
      </div>

      {/* Background Texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
      />

      <Toolbar
        currentTool={currentTool}
        setTool={setCurrentTool}
        currentColor={currentColor}
        setColor={setCurrentColor}
        currentWidth={currentWidth}
        setWidth={setCurrentWidth}
        undo={undo}
        redo={redo}
        canUndo={historyStep >= -1}
        canRedo={historyStep < history.length - 1}
      />

      <Board
        elements={elements}
        currentElement={currentElement}
        currentTool={currentTool}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTextSubmit={handleTextSubmit}
      />
    </div>
  );
}

export default App;
