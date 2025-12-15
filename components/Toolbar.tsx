import React from 'react';
import { 
  Pencil, 
  Eraser,
  Type as TypeIcon, 
  Undo2, 
  Redo2
} from 'lucide-react';
import { ToolType } from '../types';
import { COLORS, STROKE_WIDTHS } from '../constants';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  currentColor: string;
  setColor: (color: string) => void;
  currentWidth: number;
  setWidth: (width: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  currentColor,
  setColor,
  currentWidth,
  setWidth,
  undo,
  redo,
  canUndo,
  canRedo
}) => {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black border border-stone-700 rounded-full px-6 py-3 flex items-center gap-6 shadow-[0_0_20px_rgba(0,0,0,0.5)] z-50 text-stone-200">
      
      {/* Tools */}
      <div className="flex items-center gap-2 border-r border-stone-800 pr-6">
        <button
          onClick={() => setTool(ToolType.PEN)}
          className={`p-3 rounded-full transition-all ${currentTool === ToolType.PEN ? 'bg-white text-black' : 'hover:bg-stone-900 text-stone-400'}`}
          title="Freehand (Pen)"
        >
          <Pencil size={20} />
        </button>
        <button
          onClick={() => setTool(ToolType.ERASER)}
          className={`p-3 rounded-full transition-all ${currentTool === ToolType.ERASER ? 'bg-white text-black' : 'hover:bg-stone-900 text-stone-400'}`}
          title="Eraser"
        >
          <Eraser size={20} />
        </button>
         <button
          onClick={() => setTool(ToolType.TEXT)}
          className={`p-3 rounded-full transition-all ${currentTool === ToolType.TEXT ? 'bg-white text-black' : 'hover:bg-stone-900 text-stone-400'}`}
          title="Text Tool"
        >
          <TypeIcon size={20} />
        </button>
      </div>

      {/* Colors */}
      <div className="flex items-center gap-3 border-r border-stone-800 pr-6">
        {COLORS.map(color => (
          <button
            key={color}
            onClick={() => setColor(color)}
            className={`w-6 h-6 rounded-full border-2 ${currentColor === color ? 'border-white scale-125' : 'border-transparent hover:scale-125'} transition-transform`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

       {/* Stroke Width */}
       <div className="flex items-center gap-3 border-r border-stone-800 pr-6">
        {STROKE_WIDTHS.map(width => (
           <button
           key={width}
           onClick={() => setWidth(width)}
           className={`rounded-full bg-stone-600 ${currentWidth === width ? 'bg-white' : 'hover:bg-stone-500'} transition-colors`}
           style={{ width: width * 2 + 4, height: width * 2 + 4 }}
           title={`Width ${width}`}
         />
        ))}
      </div>


      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`p-3 rounded-full transition-colors ${!canUndo ? 'opacity-30 cursor-not-allowed' : 'hover:bg-stone-900 text-white'}`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={20} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`p-3 rounded-full transition-colors ${!canRedo ? 'opacity-30 cursor-not-allowed' : 'hover:bg-stone-900 text-white'}`}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={20} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;