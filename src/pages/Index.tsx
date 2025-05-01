import React, { useState, useCallback } from "react";
import PdfViewer from "@/components/PdfViewer";
import { toast } from "@/hooks/use-toast";
import { 
  Folder, 
  FileText,
  Search, 
  Upload, 
  FolderPlus, 
  Tag,
  List,
  Grid,
  ChevronLeft,
  Download,
  Info,
  Share2,
  MoreVertical,
  ChevronRight
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Type definitions for our document system
type DocumentType = "pdf" | "image" | "document" | "other";

interface DocumentItem {
  id: string;
  name: string;
  type: DocumentType;
  file: File;
  tags: string[];
  createdAt: Date;
  folderId: string | null;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
}

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([
    { id: "root", name: "My Documents", parentId: null }
  ]);
  const [currentFolder, setCurrentFolder] = useState<string>("root");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [availableTags, setAvailableTags] = useState<string[]>(["important", "work", "personal"]);
  const [dragActive, setDragActive] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Filter documents by current folder and search query
  const filteredDocuments = documents.filter(doc => {
    const inCurrentFolder = doc.folderId === currentFolder;
    const matchesSearch = searchQuery === "" || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return inCurrentFolder && matchesSearch;
  });

  // Get subfolders of current folder
  const currentSubfolders = folders.filter(folder => folder.parentId === currentFolder);

  // Get current folder breadcrumb path
  const getBreadcrumbPath = (folderId: string): FolderItem[] => {
    const path: FolderItem[] = [];
    let current = folders.find(f => f.id === folderId);
    
    while (current) {
      path.unshift(current);
      current = current.parentId ? folders.find(f => f.id === current?.parentId) : null;
    }
    
    return path;
  };
  
  const breadcrumbPath = getBreadcrumbPath(currentFolder);

  // File handling functions
  const onFileChange = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    const file = fileList[0];
    if (file.type !== "application/pdf") {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF document.",
      });
      return;
    }
    
    // Add document to our document array
    const newDocument: DocumentItem = {
      id: generateId(),
      name: file.name,
      type: "pdf",
      file,
      tags: [],
      createdAt: new Date(),
      folderId: currentFolder
    };
    
    setDocuments(prev => [...prev, newDocument]);
    setSelectedFile(file);
    
    toast({
      title: "File uploaded",
      description: `${file.name} has been added to your documents.`
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      onFileChange(e.dataTransfer.files);
    },
    [currentFolder]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e.target.files);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  
  // Open a document
  const openDocument = (doc: DocumentItem) => {
    setSelectedFile(doc.file);
  };
  
  // Add tag to document
  const addTagToDocument = (docId: string, tag: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        if (!doc.tags.includes(tag)) {
          return { ...doc, tags: [...doc.tags, tag] };
        }
      }
      return doc;
    }));
  };
  
  // Remove tag from document
  const removeTagFromDocument = (docId: string, tag: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        return { ...doc, tags: doc.tags.filter(t => t !== tag) };
      }
      return doc;
    }));
  };
  
  // Create a new folder
  const createFolder = () => {
    if (!newFolderName.trim()) {
      toast({
        title: "Folder name required",
        description: "Please enter a name for the new folder.",
      });
      return;
    }
    
    const newFolder: FolderItem = {
      id: generateId(),
      name: newFolderName,
      parentId: currentFolder
    };
    
    setFolders(prev => [...prev, newFolder]);
    setNewFolderName("");
    
    toast({
      title: "Folder created",
      description: `${newFolderName} has been created.`
    });
  };
  
  // Navigate to folder
  const navigateToFolder = (folderId: string) => {
    setCurrentFolder(folderId);
  };
  
  // Helper function to generate random IDs
  const generateId = () => Math.random().toString(36).substring(2, 15);
  
  // Navigate to parent folder
  const navigateToParentFolder = () => {
    const currentFolderObj = folders.find(f => f.id === currentFolder);
    if (currentFolderObj?.parentId) {
      setCurrentFolder(currentFolderObj.parentId);
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const renderDocumentViewer = () => (
    <div className="bg-white shadow-xl rounded-lg overflow-hidden transition-all">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setSelectedFile(null)}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-medium">{selectedFile?.name}</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            title="Share"
          >
            <Share2 className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Properties</DropdownMenuItem>
              <DropdownMenuItem>Print</DropdownMenuItem>
              <DropdownMenuItem>Add to favorites</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="p-1">
        <PdfViewer file={selectedFile} />
      </div>
    </div>
  );

  const renderFileBrowser = () => (
    <div className="bg-white shadow-xl rounded-lg p-6 transition-all">
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search documents and tags..."
              className="pl-9 w-64 bg-gray-50 border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode("list")}
            className={viewMode === "list" ? "bg-blue-50 text-blue-600" : ""}
          >
            <List className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode("grid")}
            className={viewMode === "grid" ? "bg-blue-50 text-blue-600" : ""}
          >
            <Grid className="h-5 w-5" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <FolderPlus className="h-4 w-4" />
                <span>New Folder</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label htmlFor="folderName" className="text-sm font-medium">
                    Folder Name
                  </label>
                  <Input
                    id="folderName"
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                  />
                </div>
                <Button
                  onClick={createFolder}
                  className="w-full"
                >
                  Create Folder
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Tag className="h-4 w-4" />
                <span>Tags</span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Manage Tags</SheetTitle>
              </SheetHeader>
              <div className="py-4">
                <ul className="space-y-2">
                  {availableTags.map(tag => (
                    <li key={tag} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm">{tag}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {/* Breadcrumb Navigation */}
      <div className="flex items-center mb-5 text-sm bg-gray-50 -mx-6 px-6 py-2">
        <div className="flex items-center gap-1 flex-wrap">
          {breadcrumbPath.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <button
                onClick={() => navigateToFolder(folder.id)}
                className={cn(
                  "hover:text-blue-600 flex items-center",
                  index === breadcrumbPath.length - 1 
                    ? "font-medium text-blue-600" 
                    : "text-gray-600"
                )}
              >
                {index === 0 && <Folder className="h-4 w-4 mr-1" />}
                {folder.name}
              </button>
              {index < breadcrumbPath.length - 1 && (
                <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {/* File Drop Zone */}
      <div
        className={cn(
          "border-2 border-dashed transition-all rounded-lg flex flex-col items-center justify-center py-10 cursor-pointer mb-6",
          dragActive 
            ? "border-blue-500 bg-blue-50" 
            : "border-gray-300 hover:bg-gray-50 hover:border-gray-400"
        )}
        onDrop={handleDrop}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onClick={() => {
          const input = document.getElementById("pdf-upload");
          input && input.click();
        }}
      >
        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
          <Upload className="w-7 h-7" />
        </div>
        <span className="text-lg text-gray-700 font-medium">
          Drag & drop a PDF here
        </span>
        <p className="text-sm text-gray-500 mt-1">
          or <span className="text-blue-600 hover:underline">browse</span> from your device
        </p>
        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={handleFileInput}
        />
      </div>
      
      {/* Document and Folder List */}
      <div>
        {currentSubfolders.length === 0 && filteredDocuments.length === 0 && (
          <div className="text-center py-16 bg-gray-50 rounded-lg">
            <Info className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">This folder is empty</p>
            <p className="text-gray-500 text-sm mt-1">
              Upload documents or create a new folder to get started
            </p>
          </div>
        )}
        
        {/* Folders */}
        {currentSubfolders.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
              <Folder className="h-4 w-4 mr-1" />
              Folders
            </h3>
            <div className={viewMode === "grid" 
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" 
              : "space-y-2"
            }>
              {currentSubfolders.map(folder => (
                <Card 
                  key={folder.id}
                  onClick={() => navigateToFolder(folder.id)}
                  className={cn(
                    "cursor-pointer hover:border-blue-300 transition-colors overflow-hidden group",
                    viewMode === "list" && "border-0 shadow-none"
                  )}
                >
                  <CardContent className={cn(
                    "p-0",
                    viewMode === "grid" 
                      ? "flex flex-col items-center pt-6 pb-4"
                      : "flex items-center p-3 hover:bg-gray-50 rounded-lg"
                  )}>
                    <div className={cn(
                      "bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center",
                      viewMode === "grid" ? "w-16 h-16 mb-3" : "w-10 h-10 mr-3"
                    )}>
                      <Folder className={viewMode === "grid" ? "h-8 w-8" : "h-5 w-5"} />
                    </div>
                    <div className={viewMode === "grid" ? "text-center" : "flex-1"}>
                      <div className="font-medium truncate max-w-full">{folder.name}</div>
                      {viewMode === "list" && (
                        <div className="text-gray-500 text-xs">Folder</div>
                      )}
                    </div>
                    {viewMode === "list" && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        {/* Documents */}
        {filteredDocuments.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
              <FileText className="h-4 w-4 mr-1" />
              Documents
            </h3>
            <div className={viewMode === "grid" 
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" 
              : "space-y-2"
            }>
              {filteredDocuments.map(doc => (
                <Card 
                  key={doc.id}
                  onClick={() => openDocument(doc)}
                  className={cn(
                    "cursor-pointer hover:border-blue-300 transition-colors overflow-hidden group",
                    viewMode === "list" && "border-0 shadow-none"
                  )}
                >
                  <CardContent className={cn(
                    "p-0",
                    viewMode === "grid" 
                      ? "flex flex-col items-center pt-6 pb-4"
                      : "flex items-center p-3 hover:bg-gray-50 rounded-lg"
                  )}>
                    <div className={cn(
                      "bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center",
                      viewMode === "grid" ? "w-16 h-16 mb-3" : "w-10 h-10 mr-3"
                    )}>
                      <FileText className={viewMode === "grid" ? "h-8 w-8" : "h-5 w-5"} />
                    </div>
                    <div className={viewMode === "grid" ? "text-center w-full px-3" : "flex-1"}>
                      <div className="font-medium truncate max-w-full">{doc.name}</div>
                      {viewMode === "list" ? (
                        <div className="flex items-center justify-between">
                          <div className="text-gray-500 text-xs">
                            {formatDate(doc.createdAt)}
                          </div>
                          {doc.tags.length > 0 && (
                            <div className="flex gap-1">
                              {doc.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  {tag}
                                </span>
                              ))}
                              {doc.tags.length > 2 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                                  +{doc.tags.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        doc.tags.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-1 mt-2">
                            {doc.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                {tag}
                              </span>
                            ))}
                            {doc.tags.length > 2 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                                +{doc.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )
                      )}
                    </div>
                    {viewMode === "list" && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-blue-50 py-8">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-center mb-1">
          Document Viewer
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Import, organize, and annotate your documents
        </p>
        
        <div className="transition-all">
          {selectedFile ? renderDocumentViewer() : renderFileBrowser()}
        </div>
      </div>
    </div>
  );
};

export default Index;