import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { 
  BoardElement, 
  ToolType, 
  ShapeType, 
  TextElement
} from '../types';

interface BoardProps {
  elements: BoardElement[];
  currentElement: BoardElement | null;
  currentTool: ToolType;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onTextSubmit: (text: string, x: number, y: number) => void;
}

const Board: React.FC<BoardProps> = ({
  elements,
  currentElement,
  currentTool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTextSubmit
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [textInput, setTextInput] = useState<{x: number, y: number, visible: boolean}>({ x: 0, y: 0, visible: false });
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle Window Resize
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Canvas Rendering Logic
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle High DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    ctx.clearRect(0, 0, size.width, size.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawElement = (el: BoardElement) => {
        if (el.type === ShapeType.TEXT) return; // Skip text (handled in SVG)

        ctx.beginPath();
        
        // Context setup
        if (el.type === ShapeType.ERASER) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = '#000000'; // Color doesn't matter for destination-out
            ctx.lineWidth = el.strokeWidth;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = el.color;
            ctx.lineWidth = el.strokeWidth;
            ctx.fillStyle = 'transparent'; // Shapes are outlines by default
        }

        switch (el.type) {
            case ShapeType.FREEHAND:
            case ShapeType.ERASER:
                if (el.points.length > 0) {
                    ctx.moveTo(el.points[0].x, el.points[0].y);
                    for (let i = 1; i < el.points.length; i++) {
                        ctx.lineTo(el.points[i].x, el.points[i].y);
                    }
                    ctx.stroke();
                }
                break;
            case ShapeType.LINE:
                ctx.moveTo(el.start.x, el.start.y);
                ctx.lineTo(el.end.x, el.end.y);
                ctx.stroke();
                break;
            case ShapeType.SQUARE:
                ctx.rect(el.x, el.y, el.width, el.height);
                ctx.stroke();
                break;
            case ShapeType.CIRCLE: {
                const rx = el.width / 2;
                const ry = el.height / 2;
                const cx = el.x + rx;
                const cy = el.y + ry;
                ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
                ctx.stroke();
                break;
            }
            case ShapeType.TRIANGLE: {
                const p1x = el.x + el.width / 2;
                const p1y = el.y;
                const p2x = el.x;
                const p2y = el.y + el.height;
                const p3x = el.x + el.width;
                const p3y = el.y + el.height;
                ctx.moveTo(p1x, p1y);
                ctx.lineTo(p2x, p2y);
                ctx.lineTo(p3x, p3y);
                ctx.closePath();
                ctx.stroke();
                break;
            }
            case ShapeType.IMAGE: {
                const img = new Image();
                img.src = el.dataUrl;
                if (img.complete) {
                   ctx.drawImage(img, el.x, el.y, el.width, el.height);
                } else {
                   // If not loaded yet, wait? 
                   // Ideally we preload images, but for now simple handling:
                   img.onload = () => {
                       // Trigger re-render if needed, but for now this handles late loads
                       ctx.drawImage(img, el.x, el.y, el.width, el.height);
                   };
                }
                break;
            }
        }
        
        ctx.globalCompositeOperation = 'source-over'; // Reset
    };

    // Draw all existing elements
    elements.forEach(drawElement);

    // Draw current element (preview)
    if (currentElement) {
        drawElement(currentElement);
    }

  }, [elements, currentElement, size]);


  useEffect(() => {
    if (textInput.visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [textInput.visible]);

  const handleBoardClick = (e: React.MouseEvent) => {
    if (currentTool === ToolType.TEXT && !textInput.visible) {
      setTextInput({ x: e.clientX, y: e.clientY - 15, visible: true });
    }
  };

  const handleInputBlur = () => {
    if (inputRef.current?.value) {
      onTextSubmit(inputRef.current.value, textInput.x, textInput.y);
    }
    setTextInput(prev => ({ ...prev, visible: false }));
    if(inputRef.current) inputRef.current.value = '';
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
    if (e.key === 'Escape') {
      setTextInput(prev => ({ ...prev, visible: false }));
      if(inputRef.current) inputRef.current.value = '';
    }
  };

  const renderTextElement = (el: BoardElement) => {
      if (el.type !== ShapeType.TEXT) return null;
      return (
          <text
            key={el.id}
            x={el.x}
            y={el.y + el.fontSize}
            fill={el.color}
            fontSize={el.fontSize * 6}
            fontFamily="'Kalam', cursive"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {el.text}
          </text>
      );
  };

  return (
    <div className="relative w-full h-full touch-none select-none">
      {/* 1. Canvas Layer (Drawings + Eraser) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full"
      />

      {/* 2. SVG Layer (Text Overlay + Pointer Events) */}
      <svg
        className="absolute inset-0 w-full h-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={handleBoardClick}
      >
        {/* Only render text here */}
        {elements.map(renderTextElement)}
      </svg>

      {/* Floating Text Input */}
      {textInput.visible && (
        <div
          className="absolute"
          style={{ 
            left: textInput.x, 
            top: textInput.y,
            transform: 'translate(0, 0)'
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="bg-transparent text-2xl font-hand text-white border-b-2 border-white/50 focus:border-white outline-none min-w-[200px]"
            style={{ 
                fontFamily: "'Kalam', cursive",
                color: currentElement ? currentElement.color : '#fff'
             }}
            placeholder="Type here..."
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
          />
        </div>
      )}
    </div>
  );
};

export default Board;
