// This module manages the storage and retrieval of annotations by page

export type AnnotationType = 
  | 'brush' 
  | 'eraser' 
  | 'highlighter' 
  | 'rectangle' 
  | 'circle' 
  | 'arrow' 
  | 'text' 
  | 'sticky-note';

export interface Point {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  color: string;
  opacity: number;
  pageNumber: number;
  createdAt: Date;
}

export interface PathAnnotation extends BaseAnnotation {
  type: 'brush' | 'highlighter' | 'eraser';
  strokeWidth: number;
  points: Point[];
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rectangle' | 'circle';
  strokeWidth: number;
  startPoint: Point;
  endPoint: Point;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  strokeWidth: number;
  startPoint: Point;
  endPoint: Point;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  position: Point;
  fontSize: number;
}

export interface StickyNoteAnnotation extends BaseAnnotation {
  type: 'sticky-note';
  text: string;
  position: Point;
  width: number;
  height: number;
}

export type Annotation = 
  | PathAnnotation 
  | ShapeAnnotation 
  | ArrowAnnotation 
  | TextAnnotation 
  | StickyNoteAnnotation;

export interface DocumentAnnotations {
  documentId: string;
  fileName: string;
  lastModified: Date;
  pages: {
    [pageNumber: number]: Annotation[];
  };
}

// In-memory store for the current document's annotations
let currentAnnotations: DocumentAnnotations | null = null;

// Generate unique ID for annotations
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Initialize annotations for a document
export const initAnnotations = (documentId: string, fileName: string): DocumentAnnotations => {
  currentAnnotations = {
    documentId,
    fileName,
    lastModified: new Date(),
    pages: {}
  };
  return currentAnnotations;
};

// Get all annotations for a specific page
export const getPageAnnotations = (pageNumber: number): Annotation[] => {
  if (!currentAnnotations) return [];
  
  if (!currentAnnotations.pages[pageNumber]) {
    currentAnnotations.pages[pageNumber] = [];
  }
  
  return currentAnnotations.pages[pageNumber];
};

// Add an annotation to a specific page
export const addAnnotation = (annotation: Annotation): void => {
  if (!currentAnnotations) return;
  
  const pageNumber = annotation.pageNumber;
  if (!currentAnnotations.pages[pageNumber]) {
    currentAnnotations.pages[pageNumber] = [];
  }
  
  currentAnnotations.pages[pageNumber].push(annotation);
  currentAnnotations.lastModified = new Date();
};

// Remove an annotation by ID
export const removeAnnotation = (annotationId: string, pageNumber: number): void => {
  if (!currentAnnotations || !currentAnnotations.pages[pageNumber]) return;
  
  currentAnnotations.pages[pageNumber] = currentAnnotations.pages[pageNumber].filter(
    ann => ann.id !== annotationId
  );
  currentAnnotations.lastModified = new Date();
};

// Clear all annotations for a specific page
export const clearPageAnnotations = (pageNumber: number): void => {
  if (!currentAnnotations) return;
  
  currentAnnotations.pages[pageNumber] = [];
  currentAnnotations.lastModified = new Date();
};

// Clear all annotations for the current document
export const clearAllAnnotations = (): void => {
  if (!currentAnnotations) return;
  
  currentAnnotations.pages = {};
  currentAnnotations.lastModified = new Date();
};

// Get current document annotations (for saving/exporting)
export const getCurrentAnnotations = (): DocumentAnnotations | null => {
  return currentAnnotations;
};

// Local storage key for saving annotations
const ANNOTATION_STORAGE_KEY = 'pdf_annotations';

// Save annotations to localStorage
export const saveAnnotationsToStorage = (): void => {
  if (!currentAnnotations) return;
  
  try {
    // Get existing stored annotations
    const storedDataStr = localStorage.getItem(ANNOTATION_STORAGE_KEY);
    const storedData = storedDataStr ? JSON.parse(storedDataStr) : {};
    
    // Update with current document annotations
    storedData[currentAnnotations.documentId] = currentAnnotations;
    
    // Save back to localStorage
    localStorage.setItem(ANNOTATION_STORAGE_KEY, JSON.stringify(storedData));
  } catch (error) {
    console.error('Failed to save annotations to localStorage:', error);
  }
};

// Load annotations from localStorage
export const loadAnnotationsFromStorage = (documentId: string, fileName: string): DocumentAnnotations | null => {
  try {
    const storedDataStr = localStorage.getItem(ANNOTATION_STORAGE_KEY);
    if (!storedDataStr) return null;
    
    const storedData = JSON.parse(storedDataStr);
    if (storedData[documentId]) {
      currentAnnotations = storedData[documentId];
      return currentAnnotations;
    }
  } catch (error) {
    console.error('Failed to load annotations from localStorage:', error);
  }
  
  // If no stored annotations found, initialize new ones
  return initAnnotations(documentId, fileName);
};

// Export functions to allow importing elsewhere
export default {
  initAnnotations,
  getPageAnnotations,
  addAnnotation,
  removeAnnotation,
  clearPageAnnotations,
  clearAllAnnotations,
  getCurrentAnnotations,
  saveAnnotationsToStorage,
  loadAnnotationsFromStorage,
  generateId
};