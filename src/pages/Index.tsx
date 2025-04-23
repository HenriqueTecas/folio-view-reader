
import React, { useState, useCallback, useEffect } from "react";
import PdfViewer from "@/components/PdfViewer";
import { toast } from "@/hooks/use-toast";
import { 
  Folder, 
  File as FileIcon, 
  Search, 
  Upload, 
  FolderPlus, 
  Tag,
  List,
  Grid
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-blue-50 py-6">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-center mb-1">
          Document Viewer
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Import, organize, and view your documents
        </p>
        
        {!selectedFile ? (
          <div className="bg-white shadow-xl p-6 rounded-lg">
            {/* Document Browser Interface */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Command className="rounded-lg border shadow-sm">
                  <CommandInput 
                    placeholder="Search documents and tags..." 
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  {searchQuery && (
                    <CommandList>
                      <CommandEmpty>No results found</CommandEmpty>
                      <CommandGroup>
                        {filteredDocuments.map(doc => (
                          <CommandItem 
                            key={doc.id}
                            onSelect={() => openDocument(doc)}
                          >
                            <FileIcon className="mr-2 h-4 w-4" />
                            {doc.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  )}
                </Command>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-lg ${viewMode === "list" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  <List className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  <Grid className="h-5 w-5" />
                </button>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                      <FolderPlus className="h-5 w-5" />
                    </button>
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
                        <input
                          id="folderName"
                          type="text"
                          className="w-full p-2 border rounded"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={createFolder}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
                      >
                        Create Folder
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                      <Tag className="h-5 w-5" />
                    </button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Manage Tags</SheetTitle>
                    </SheetHeader>
                    <div className="py-4">
                      <ul className="space-y-2">
                        {availableTags.map(tag => (
                          <li key={tag} className="flex items-center justify-between">
                            <span className="text-sm">{tag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            
            {/* Breadcrumb Navigation */}
            <div className="flex items-center mb-4 text-sm">
              <div className="flex items-center gap-1 flex-wrap">
                {breadcrumbPath.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <button
                      onClick={() => navigateToFolder(folder.id)}
                      className={`hover:underline ${index === breadcrumbPath.length - 1 ? "font-medium" : "text-gray-600"}`}
                    >
                      {folder.name}
                    </button>
                    {index < breadcrumbPath.length - 1 && (
                      <span className="mx-1 text-gray-400">/</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
            
            {/* File Drop Zone */}
            <div
              className={`border-2 border-dashed transition-all ${
                dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
              } rounded-lg flex flex-col items-center justify-center py-16 cursor-pointer`}
              onDrop={handleDrop}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onClick={() => {
                const input = document.getElementById("pdf-upload");
                input && input.click();
              }}
            >
              <Upload className="w-10 h-10 mb-3 text-blue-500" />
              <span className="text-lg text-gray-600">
                Drag & drop a PDF here, or <span className="underline text-blue-600">browse</span>
              </span>
              <p className="text-sm text-gray-500 mt-1">
                Upload documents to your current folder
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
            <div className="mt-8">
              <h2 className="text-lg font-medium mb-4">Contents</h2>
              
              {currentSubfolders.length === 0 && filteredDocuments.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">This folder is empty</p>
                </div>
              )}
              
              {/* Folders */}
              {currentSubfolders.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm text-gray-500 mb-2">Folders</h3>
                  <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "space-y-2"}>
                    {currentSubfolders.map(folder => (
                      <div 
                        key={folder.id}
                        onClick={() => navigateToFolder(folder.id)}
                        className={viewMode === "grid" 
                          ? "bg-white border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition flex flex-col items-center"
                          : "bg-white border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition flex items-center"
                        }
                      >
                        <Folder className={`${viewMode === "grid" ? "h-8 w-8 mb-2" : "h-5 w-5 mr-3"} text-yellow-500`} />
                        <span className="text-sm font-medium truncate max-w-full">{folder.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Documents */}
              {filteredDocuments.length > 0 && (
                <div>
                  <h3 className="text-sm text-gray-500 mb-2">Documents</h3>
                  <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "space-y-2"}>
                    {filteredDocuments.map(doc => (
                      <div 
                        key={doc.id}
                        onClick={() => openDocument(doc)}
                        className={viewMode === "grid"
                          ? "bg-white border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition flex flex-col items-center"
                          : "bg-white border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition flex items-center"
                        }
                      >
                        <FileIcon className={`${viewMode === "grid" ? "h-8 w-8 mb-2" : "h-5 w-5 mr-3"} text-blue-500`} />
                        <div className={viewMode === "grid" ? "w-full text-center" : "flex-1"}>
                          <div className="text-sm font-medium truncate max-w-full">{doc.name}</div>
                          {doc.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-xl p-6 rounded-lg">
            <Tabs defaultValue="viewer">
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                  <TabsTrigger value="viewer">Document Viewer</TabsTrigger>
                </TabsList>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium transition"
                >
                  Back to Documents
                </button>
              </div>
              
              <TabsContent value="viewer" className="mt-0">
                <PdfViewer file={selectedFile} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
