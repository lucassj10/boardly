export enum ToolType {
  PEN = 'PEN',
  ERASER = 'ERASER',
  TEXT = 'TEXT',
  SELECT = 'SELECT'
}

export enum ShapeType {
  FREEHAND = 'FREEHAND',
  ERASER = 'ERASER',
  LINE = 'LINE',
  SQUARE = 'SQUARE',
  CIRCLE = 'CIRCLE',
  TRIANGLE = 'TRIANGLE',
  TEXT = 'TEXT',
  IMAGE = 'IMAGE'
}

export interface Point {
  x: number;
  y: number;
}

export interface BaseElement {
  id: string;
  type: ShapeType;
  color: string;
  strokeWidth: number;
}

export interface PathElement extends BaseElement {
  type: ShapeType.FREEHAND | ShapeType.ERASER;
  points: Point[];
}

export interface LineElement extends BaseElement {
  type: ShapeType.LINE;
  start: Point;
  end: Point;
}

export interface ShapeElement extends BaseElement {
  type: ShapeType.SQUARE | ShapeType.CIRCLE | ShapeType.TRIANGLE;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Point[]; // Used for preserving triangle orientation/vertices
}

export interface TextElement extends BaseElement {
  type: ShapeType.TEXT;
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export interface ImageElement extends BaseElement {
  type: ShapeType.IMAGE;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
}

export type BoardElement = PathElement | LineElement | ShapeElement | TextElement | ImageElement;

export interface GeminiShapeResponse {
  isShape: boolean;
  shapeType: 'triangle' | 'square' | 'circle' | 'none';
}