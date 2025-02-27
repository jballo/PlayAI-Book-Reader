"use client";

import { SignedIn, SignedOut, SignInButton, SignOutButton, useUser } from "@clerk/nextjs";
import { Button } from "../ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/TextLayer.css'; // Import the TextLayer CSS
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'; // Import AnnotationLayer CSS, if needed
import AudioPlayer from "./Audioplayer";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock, Download, Play, Shuffle } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();



interface UserProps {
    createUser: (
        userId: string,
        userEmail: string,
    ) => Promise<{success: boolean; response?: string; error?: string;}>;
    userExists: (
        userId: string,
    ) => Promise<{ success: boolean; response?: boolean; error?: string; }>;
}

interface PDF {
    url: string,
    key: string,
}

interface PdfProps {
    uploadPdf: (
        pdf: FormData
    ) => Promise<{ success: boolean; response?: PDF; error?: string; }>;
    uploadPdfMetadata: (
        userId: string,
        pdf_key: string,
        pdf_url: string,
        pdf_text: string[]
    ) => Promise<{ success: boolean; response?: boolean; error?: string; }>;
}

interface AudioProps {
    convertTextToSpeech: (
        text: string
    ) => Promise<{
        audioUrl: string;
        success: boolean;
        error?: string;
    }>;
}


interface DashboardProps {
    createUser: UserProps["createUser"];
    userExists: UserProps["userExists"];
    uploadPdf: PdfProps["uploadPdf"];
    uploadPdfMetadata: PdfProps["uploadPdfMetadata"];
    convertTextToSpeech: AudioProps["convertTextToSpeech"];
}

// Mock recent PDFs
const recentPdfs = [
  { name: "Project Documentation.pdf", lastOpened: "2 hours ago" },
  { name: "Research Paper.pdf", lastOpened: "Yesterday" },
  { name: "Meeting Notes.pdf", lastOpened: "3 days ago" },
  { name: "Book Chapter 1.pdf", lastOpened: "1 week ago" },
]



export default function Dashboard({ createUser, userExists, uploadPdf, uploadPdfMetadata, convertTextToSpeech }: DashboardProps){
    const { user, isSignedIn } = useUser();
    const [numPages, setNumPages] = useState<number>();
    const [pageNumber, setPageNumber] = useState<number>();
    // const [data, setData] = useState<File | null>(null);
    const [pdfFile, setPdfFile] = useState<string | null>(null);

     // state for text extraction
    const [pagesText, setPagesText] = useState<string[]>([]);


    const [isDragging, setIsDragging] = useState<boolean>(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    // const [pageRendering, setPageRendering] = useState(false);


    useEffect(() => {

        const userSaved = async () => {
            if (user && isSignedIn) {
                
                const userExistResponse = await userExists(user.id);

                if (userExistResponse.success) {

                    if (!userExistResponse.response) {
                        const response = await createUser(user.id, user.primaryEmailAddress?.emailAddress || "");
                        if(!response.success){
                            console.log(response.error);
                        }
                    }

                } else {
                    console.log(userExistResponse.error);
                }


            }
        };
        
        userSaved();
    }, [user, isSignedIn]);

    const extractAllPagesText = async (pdfUrl: string) => {
        if (!pdfUrl) return;
        
        try {
            
            // Load the PDF document
            const loadingTask = pdfjs.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            
            const extractedText: string[] = [];
            
            // Process each page
            for (let i = 1; i <= pdf.numPages; i++) {
                
                const page = await pdf.getPage(i);
                
                
                const textContent = await page.getTextContent();
                
                
                const pageText = textContent.items
                    .map(item => ('str' in item ? item.str : ''))
                    .join(' ');
                extractedText.push(pageText);
            }
            
            setPagesText(extractedText);
            console.log(`Extracted text from ${extractedText.length} pages`);
            return extractedText;
        } catch (error) {
            console.error("Error extracting PDF text:", error);
        }
    };


    function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
        setNumPages(numPages);
        setPageNumber(1);
    }

    function changePage(offset: number) {
        // setPageRendering(true);
        setPageNumber(prevPageNumber => (prevPageNumber || 1) + offset);
    }

    function previousPage() {
        changePage(-1);
    }

    function nextPage() {
        changePage(1);
    }


    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const file = e.dataTransfer.files[0]
        if (file && file.type === "application/pdf") {
            //   setPdfFile(file)
            // setPageNumber(1)

            const actionFormData = new FormData();
            actionFormData.append("pdf", file);

            const uploadpdf_response = await uploadPdf(actionFormData);

            if (!uploadpdf_response.success){
                console.error("PDF upload failed");
                return;
            }
            
            const pdfUrl = uploadpdf_response.response?.url || "";
            const pdfKey = uploadpdf_response.response?.key || "";
            setPdfFile(pdfUrl)

            if (!(pdfUrl && pdfKey)){
                console.error("No pdf url and/or returned from upload");
                return;
            }
            const pdfText = await extractAllPagesText(pdfUrl);
            console.log("pdfText: ", pdfText);

            if(!(user && isSignedIn)){
                console.error("User not signed in and/or authenticated...");
                return;
            }
            await uploadPdfMetadata(user.id, pdfKey, pdfUrl, pdfText || []);
        }
    }

    const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type === "application/pdf") {
            // setPdfFile(file)
            // setPageNumber(1)

            const actionFormData = new FormData();
            actionFormData.append("pdf", file);

            const uploadpdf_response = await uploadPdf(actionFormData);

            if (!uploadpdf_response.success){
                console.error("PDF upload failed");
                return;
            }
            
            const pdfUrl = uploadpdf_response.response?.url || "";
            const pdfKey = uploadpdf_response.response?.key || "";
            setPdfFile(pdfUrl)

            if (!(pdfUrl && pdfKey)){
                console.error("No pdf url and/or returned from upload");
                return;
            }
            const pdfText = await extractAllPagesText(pdfUrl);
            console.log("pdfText: ", pdfText);

            if(!(user && isSignedIn)){
                console.error("User not signed in and/or authenticated...");
                return;
            }
            await uploadPdfMetadata(user.id, pdfKey, pdfUrl, pdfText || []);
        }
    }

    const MemoizedPage = useMemo(() => {
        return (
            <Page 
            pageNumber={pageNumber}
            // onRenderSuccess={() => setPageRendering(false)}
            // onRenderError={() => setPageRendering(false)}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={<div className="flex justify-center p-10"><div className="animate-pulse">Loading page...</div></div>}
            />
        );
    }, [pageNumber]);

    return (<div className="min-h-screen bg-black text-white">
        {/* Top Banner */}
        <div className="bg-[#C1FF7A] text-black px-4 py-2 text-center text-sm font-medium">
            <span className="inline-flex items-center">
                NEW MODEL
                <span className="mx-2">•</span>
                Meet PlayAI Book Reader - a voice model for fluid, emotive reading.
                <Button variant="link" className="text-black font-semibold ml-2">
                    Learn more →
                </Button>
            </span>
        </div>
        
        <div className="flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <header className="flex justify-between items-center mb-12">
                <h1 className="text-5xl font-bold tracking-tight">PlayAI Book Reader</h1>
                <div className="flex items-center space-x-2">
                    <SignedIn>
                        <SignOutButton>
                            <Button>Sign Out</Button>
                        </SignOutButton>
                    </SignedIn>
                    <SignedOut>
                        <SignInButton>
                            <Button>Sign In</Button>
                        </SignInButton>
                    </SignedOut>
                </div>
            </header>
            
            {!pdfFile ? (
                <div className="space-y-8">
                    <motion.div
                        className={`border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ease-in-out ${
                            isDragging ? "border-[#C1FF7A] bg-[#C1FF7A] bg-opacity-5" : "border-zinc-800 hover:border-zinc-700"
                        }`}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                    >
                        <div className="text-center">
                            <Shuffle className="mx-auto h-12 w-12 text-zinc-500" />
                            <h2 className="mt-6 text-2xl font-semibold">Upload your PDF</h2>
                            <p className="mt-2 text-zinc-400">Drag and drop your file here, or click to select</p>
                            <input ref={fileInputRef} type="file" accept=".pdf" className="sr-only" onChange={onFileChange} />
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-6 bg-[#C1FF7A] text-black hover:bg-[#B1EF6A] transition-colors"
                            >
                                Select PDF file
                            </Button>
                        </div>
                    </motion.div>
                    <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Recent PDFs</h2>
                        <Button variant="ghost" className="text-zinc-400 hover:text-white">
                        View all
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recentPdfs.map((pdf, index) => (
                        <motion.div
                            key={pdf.name}
                            className="bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors cursor-pointer group"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-zinc-700 transition-colors">
                                <Download className="h-5 w-5 text-[#C1FF7A]" />
                                </div>
                                <div>
                                <h3 className="font-medium text-white">{pdf.name}</h3>
                                <p className="text-sm text-zinc-400 flex items-center mt-1">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {pdf.lastOpened}
                                </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                            </div>
                        </motion.div>
                        ))}
                    </div>
                    </div>
                </div>
            ) : (
                <div className="bg-zinc-900 rounded-2xl overflow-hidden">
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Button
                                variant="ghost"
                                className="hover:bg-zinc-800"
                                disabled={(pageNumber || 1) <= 1}
                                onClick={previousPage}
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                            <span className="text-sm text-zinc-400">
                                Page {pageNumber || (numPages ? 1 : '--')} of {numPages || '--'}
                            </span>
                            <Button
                                variant="ghost"
                                className="hover:bg-zinc-800"
                                disabled={(pageNumber || 0) >= (numPages || 0)}
                                onClick={nextPage}
                            >
                                <ChevronRight className="h-6 w-6" />
                            </Button>
                        </div>

                        
                        <div className="pdf-container h-[calc(100vh-420px)] min-h-[400px] overflow-y-auto">
                            <Document
                                file={pdfFile}
                                onLoadSuccess={onDocumentLoadSuccess}
                            >
                                {MemoizedPage}
                            </Document>
                        </div>

                        <div className="flex items-center justify-between gap-12">
                            <div className="flex items-center space-x-4">
                                <AudioPlayer 
                                    text={pagesText[(pageNumber || 1) - 1] || ""}
                                    convertTextToSpeech={convertTextToSpeech}
                                />
                            </div>
                            <div className="flex items-center">
                                <h3 className="font-medium mb-2">Current Page Text:</h3>
                                <div className="max-h-40 overflow-y-auto  p-3 text-sm">
                                    {pagesText[(pageNumber || 1)-1] || "No text found on this page"}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
  </div>);
}