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

// Resample points to be equidistant
const resample = (points: Point[], spacing: number): Point[] => {
  if (points.length < 2) return points;
  
  const newPoints: Point[] = [points[0]];
  let currentDist = 0;
  
  for (let i = 1; i < points.length; i++) {
    let pt1 = points[i-1];
    let pt2 = points[i];
    let d = distance(pt1, pt2);
    
    if (currentDist + d >= spacing) {
      let qx = pt1.x + ((spacing - currentDist) / d) * (pt2.x - pt1.x);
      let qy = pt1.y + ((spacing - currentDist) / d) * (pt2.y - pt1.y);
      let q = { x: qx, y: qy };
      newPoints.push(q);
      points.splice(i, 0, q); // Insert q so we can continue from it
      currentDist = 0;
    } else {
      currentDist += d;
    }
  }
  return newPoints;
};

// ShortStraw Corner Detection
const getCorners = (points: Point[]): number[] => {
  if (points.length < 10) return [];
  
  const W = 3; // Window size (straw length = 2*W*spacing usually)
  const straws: number[] = [];
  
  // Calculate straw distances
  for (let i = W; i < points.length - W; i++) {
    straws[i] = distance(points[i - W], points[i + W]);
  }
  
  // Find local minima
  const corners: number[] = [];
  
  let localMinima: number[] = [];
  
  for (let i = W + 1; i < points.length - W - 1; i++) {
    if (straws[i] < straws[i-1] && straws[i] < straws[i+1]) {
        localMinima.push(i);
    }
  }

  // Filter based on threshold
  // Estimate average spacing
  let avgSpacing = 0;
  for(let i=1; i<points.length; i++) avgSpacing += distance(points[i-1], points[i]);
  avgSpacing /= (points.length - 1);
  
  const windowArc = 2 * W * avgSpacing;
  
  localMinima.forEach(index => {
      if (straws[index] < windowArc * 0.95) { // 0.95 allows for some curve, but catches corners. Increased sensitivity.
          corners.push(index);
      }
  });

  return corners;
};

// Distance from point p to segment v-w
const distToSegment = (p: Point, v: Point, w: Point) => {
  const l2 = Math.pow(distance(v, w), 2);
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

// Helper to extract 3 best vertices for a triangle from a set of points
const getTriangleVertices = (points: Point[]): Point[] => {
  if (points.length < 3) return points;
  
  // 1. Find centroid
  let cx = 0, cy = 0;
  points.forEach(p => { cx += p.x; cy += p.y; });
  cx /= points.length;
  cy /= points.length;
  const center = { x: cx, y: cy };

  // 2. Find P1: furthest from center
  let p1 = points[0];
  let maxD = -1;
  points.forEach(p => {
    const d = distance(p, center);
    if (d > maxD) { maxD = d; p1 = p; }
  });

  // 3. Find P2: furthest from P1
  let p2 = points[0];
  maxD = -1;
  points.forEach(p => {
    const d = distance(p, p1);
    if (d > maxD) { maxD = d; p2 = p; }
  });

  // 4. Find P3: furthest from line P1-P2
  let p3 = points[0];
  maxD = -1;
  points.forEach(p => {
    const d = distToSegment(p, p1, p2);
    if (d > maxD) { maxD = d; p3 = p; }
  });

  // Sort them to keep consistent winding if needed, but for drawing triangle it doesn't matter much
  // unless we want to do inclusion checks.
  return [p1, p2, p3];
};

export const detectShape = (points: Point[]): { type: ShapeType, points?: Point[] } | null => {
  if (points.length < 10) return null;

  const len = getPathLength(points);
  const dist = distance(points[0], points[points.length - 1]);
  const bbox = getBoundingBox(points);
  
  // 1. Line Check
  // If open and straight-ish
  if (dist > len * 0.85) {
      return { type: ShapeType.LINE };
  }
  
  // If not closed, return null (unless we want to force close shapes)
  if (dist > len * 0.3) return null; // Gap is too big

  // 2. Resample
  const diag = Math.hypot(bbox.width, bbox.height);
  const spacing = Math.max(5, diag / 40);
  
  // Close the loop for resampling
  const closedPoints = [...points];
  closedPoints.push(points[0]); 
  
  const resampled = resample(closedPoints, spacing);
  
  // 3. Find Corners
  const corners = getCorners(resampled);
  
  // Post-process corners: Filter adjacent corners
  const cleanCorners: number[] = [];
  if (corners.length > 0) {
      cleanCorners.push(corners[0]);
      for (let i = 1; i < corners.length; i++) {
          if (corners[i] - corners[i-1] > 3) {
              cleanCorners.push(corners[i]);
          }
      }
      if (cleanCorners.length > 1) {
         const first = cleanCorners[0];
         const last = cleanCorners[cleanCorners.length - 1];
         if ((resampled.length - last) + first < 4) {
             cleanCorners.pop();
         }
      }
  }

  const cornerCount = cleanCorners.length;

  // 4. Classification
  
  // TRIANGLE
  if (cornerCount === 3) {
      const cornerPoints = cleanCorners.map(i => resampled[i]);
      return { type: ShapeType.TRIANGLE, points: cornerPoints };
  }
  
  // SQUARE / RECTANGLE
  if (cornerCount === 4) {
      return { type: ShapeType.SQUARE };
  }

  // 5. Fallbacks based on metrics
  const center = { x: bbox.x + bbox.width/2, y: bbox.y + bbox.height/2 };
  const radii = points.map(p => distance(p, center));
  const meanRadius = radii.reduce((a,b) => a+b, 0) / radii.length;
  const variance = radii.reduce((a,b) => a + Math.pow(b - meanRadius, 2), 0) / radii.length;
  const stdDev = Math.sqrt(variance);
  const radiusRatio = meanRadius > 0 ? stdDev / meanRadius : 1;
  
  const polyArea = Math.abs(getPolygonArea(points)); 
  const boxArea = bbox.width * bbox.height;
  const areaRatio = boxArea > 0 ? polyArea / boxArea : 0;

  // Decision Tree
  
  if (cornerCount === 0 && radiusRatio < 0.25) {
      return { type: ShapeType.CIRCLE };
  }

  if (radiusRatio < 0.20) return { type: ShapeType.CIRCLE };
  
  if (areaRatio > 0.80) return { type: ShapeType.SQUARE };
  
  if (areaRatio < 0.65) {
      // It's a triangle fallback. Calculate vertices from the original shape to preserve orientation.
      // Use the resampled points for smoother vertex finding
      const trianglePoints = getTriangleVertices(resampled);
      return { type: ShapeType.TRIANGLE, points: trianglePoints };
  }

  if (cornerCount === 5) return { type: ShapeType.SQUARE };

  return { type: ShapeType.SQUARE };
};

export const getPolygonArea = (points: Point[]) => {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
};

export const isPointNearElement = (element: BoardElement, point: Point, threshold: number = 10): boolean => {
  switch (element.type) {
    case ShapeType.FREEHAND: {
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
    case ShapeType.IMAGE: { 
      return point.x >= element.x && point.x <= element.x + element.width &&
             point.y >= element.y && point.y <= element.y + element.height;
    }
    case ShapeType.CIRCLE: {
      const rx = element.width / 2;
      const ry = element.height / 2;
      const cx = element.x + rx;
      const cy = element.y + ry;
      const val = Math.pow(point.x - cx, 2) / Math.pow(rx, 2) + Math.pow(point.y - cy, 2) / Math.pow(ry, 2);
      return val <= 1;
    }
    case ShapeType.TRIANGLE: {
      // Use stored points if available
      let p1, p2, p3;
      if (element.points && element.points.length === 3) {
        [p1, p2, p3] = element.points;
      } else {
        // Fallback
        p1 = { x: element.x + element.width / 2, y: element.y };
        p2 = { x: element.x, y: element.y + element.height };
        p3 = { x: element.x + element.width, y: element.y + element.height };
      }

      const sign = (p1: Point, p2: Point, p3: Point) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
      const d1 = sign(point, p1, p2);
      const d2 = sign(point, p2, p3);
      const d3 = sign(point, p3, p1);

      const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

      return !(hasNeg && hasPos);
    }
    case ShapeType.TEXT: {
       const estimatedHeight = element.fontSize * 1.5;
       const estimatedWidth = element.text.length * element.fontSize * 0.6;
       return point.x >= element.x && point.x <= element.x + estimatedWidth &&
              point.y >= element.y - element.fontSize && point.y <= element.y + estimatedHeight/2;
    }
    default:
      return false;
  }
};