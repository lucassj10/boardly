import { Point, BoardElement, ShapeType } from '../types';

export const getBoundingBox = (points: Point[]) => {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

export const distance = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

export const getPathLength = (points: Point[]) => {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += distance(points[i-1], points[i]);
  }
  return len;
};

// Distance from point p to segment v-w
const distToSegment = (p: Point, v: Point, w: Point) => {
  const l2 = Math.pow(distance(v, w), 2);
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

// Ramer-Douglas-Peucker simplification
const simplifyPath = (points: Point[], tolerance: number): Point[] => {
  if (points.length <= 2) return points;

  let maxSqDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = distToSegment(points[i], points[0], points[end]);
    if (d > maxSqDist) {
      maxSqDist = d;
      index = i;
    }
  }

  if (maxSqDist > tolerance) {
    const left = simplifyPath(points.slice(0, index + 1), tolerance);
    const right = simplifyPath(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[end]];
};

export const detectShape = (points: Point[]): { type: ShapeType } | null => {
  if (points.length < 5) return null;

  const len = getPathLength(points);
  const dist = distance(points[0], points[points.length - 1]);
  const bbox = getBoundingBox(points);
  
  // 1. Line Detection
  // If the direct distance is very close to total path length, it's a straight line
  if (dist / len > 0.90) { 
     return { type: ShapeType.LINE };
  }

  // 2. Closed Shape Check
  // If ends are far apart relative to length, it's probably an open curve (unless it's a line, handled above)
  if (dist > len * 0.3) return null;

  // 3. Polygon Detection (Triangle/Square) via RDP
  // Calculate bounding box diagonal for relative tolerance
  const diag = Math.hypot(bbox.width, bbox.height);
  // Tolerance ~6% of diagonal is usually good for distinguishing corners vs curves
  const tolerance = diag * 0.06; 
  
  const simplified = simplifyPath(points, tolerance);
  
  // Triangle: 3 points (Start->Turn->End??) or 4 points (Start->A->B->Start)
  if (simplified.length === 3 || simplified.length === 4) {
      return { type: ShapeType.TRIANGLE };
  }

  // Square/Rect: 5 points (Start->A->B->C->Start)
  if (simplified.length === 5) {
      return { type: ShapeType.SQUARE };
  }

  // 4. Circle Detection (Standard Deviation of Radius)
  // Only check if it didn't match a simple polygon.
  // Circles usually simplify to > 5 segments with this tolerance.
  
  const center = { x: bbox.x + bbox.width/2, y: bbox.y + bbox.height/2 };
  const radii = points.map(p => distance(p, center));
  const meanRadius = radii.reduce((a,b) => a+b, 0) / radii.length;
  const variance = radii.reduce((a,b) => a + Math.pow(b - meanRadius, 2), 0) / radii.length;
  const stdDev = Math.sqrt(variance);

  // If variation is low (< 15%), it's likely a circle.
  // Squares have much higher variance (> 15-20%).
  if (stdDev / meanRadius < 0.15) {
      return { type: ShapeType.CIRCLE };
  }

  return null;
};

export const isPointNearElement = (element: BoardElement, point: Point, threshold: number = 10): boolean => {
  switch (element.type) {
    case ShapeType.FREEHAND: {
      // Check distance to any segment
      for (let i = 0; i < element.points.length - 1; i++) {
        if (distToSegment(point, element.points[i], element.points[i+1]) < threshold) {
          return true;
        }
      }
      return false;
    }
    case ShapeType.LINE: {
      return distToSegment(point, element.start, element.end) < threshold;
    }
    case ShapeType.SQUARE: 
    case ShapeType.IMAGE: { // Treat image like rect
      // Check if point is inside or near border.
      // For eraser, inside is easier for "wiping"
      return point.x >= element.x && point.x <= element.x + element.width &&
             point.y >= element.y && point.y <= element.y + element.height;
    }
    case ShapeType.CIRCLE: {
      const rx = element.width / 2;
      const ry = element.height / 2;
      const cx = element.x + rx;
      const cy = element.y + ry;
      // Ellipse equation check: (x-cx)^2/rx^2 + (y-cy)^2/ry^2 <= 1
      const val = Math.pow(point.x - cx, 2) / Math.pow(rx, 2) + Math.pow(point.y - cy, 2) / Math.pow(ry, 2);
      return val <= 1;
    }
    case ShapeType.TRIANGLE: {
      // Point in polygon test for triangle
      const p1 = { x: element.x + element.width / 2, y: element.y };
      const p2 = { x: element.x, y: element.y + element.height };
      const p3 = { x: element.x + element.width, y: element.y + element.height };

      // Barycentric coordinate system or simple area sum
      const sign = (p1: Point, p2: Point, p3: Point) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
      const d1 = sign(point, p1, p2);
      const d2 = sign(point, p2, p3);
      const d3 = sign(point, p3, p1);

      const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

      return !(hasNeg && hasPos);
    }
    case ShapeType.TEXT: {
       // Estimate text box
       const estimatedHeight = element.fontSize * 1.5;
       const estimatedWidth = element.text.length * element.fontSize * 0.6;
       return point.x >= element.x && point.x <= element.x + estimatedWidth &&
              point.y >= element.y - element.fontSize && point.y <= element.y + estimatedHeight/2;
    }
    default:
      return false;
  }
};
