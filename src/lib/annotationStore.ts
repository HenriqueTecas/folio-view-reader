
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

// Auto-save timer reference
let autoSaveTimer: number | null = null;
const AUTO_SAVE_DELAY = 3000; // 3 seconds

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
  
  // Set up auto-save
  setupAutoSave();
  
  return currentAnnotations;
};

// Set up auto-save timer
const setupAutoSave = () => {
  // Clear any existing timer
  if (autoSaveTimer !== null) {
    clearInterval(autoSaveTimer);
  }
  
  // Set up new auto-save timer
  autoSaveTimer = window.setInterval(() => {
    saveAnnotationsToStorage();
  }, AUTO_SAVE_DELAY);
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

// Local storage keys
const ANNOTATION_STORAGE_KEY = 'pdf_annotations';
const DOCUMENTS_STORAGE_KEY = 'pdf_documents';

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
    
    // Show save indicator (could be implemented in UI)
    console.log('Annotations auto-saved at', new Date().toLocaleTimeString());
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
      
      // Set up auto-save for the loaded document
      setupAutoSave();
      
      return currentAnnotations;
    }
  } catch (error) {
    console.error('Failed to load annotations from localStorage:', error);
  }
  
  // If no stored annotations found, initialize new ones
  return initAnnotations(documentId, fileName);
};

// Save document metadata to localStorage
export const saveDocumentMetadata = (document: {id: string; name: string; lastAccessed: Date}): void => {
  try {
    const storedDataStr = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    const storedData = storedDataStr ? JSON.parse(storedDataStr) : {};
    
    // Update or add document metadata
    storedData[document.id] = {
      name: document.name,
      lastAccessed: document.lastAccessed
    };
    
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(storedData));
  } catch (error) {
    console.error('Failed to save document metadata:', error);
  }
};

// Get all stored document metadata
export const getAllDocumentMetadata = (): {id: string; name: string; lastAccessed: Date}[] => {
  try {
    const storedDataStr = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (!storedDataStr) return [];
    
    const storedData = JSON.parse(storedDataStr);
    return Object.entries(storedData).map(([id, data]: [string, any]) => ({
      id,
      name: data.name,
      lastAccessed: new Date(data.lastAccessed)
    }));
  } catch (error) {
    console.error('Failed to get document metadata:', error);
    return [];
  }
};

// Clean up function to remove auto-save timer
export const cleanup = () => {
  if (autoSaveTimer !== null) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
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
  saveDocumentMetadata,
  getAllDocumentMetadata,
  cleanup,
  generateId
};
