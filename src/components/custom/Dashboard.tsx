"use client";
import "core-js/proposals/promise-with-resolvers";
import { useUser } from "@clerk/nextjs";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
// import PdfView from "./PdfView";
import PdfListView from "./PdfListView";
import FileUploader from "./FileUploader";
import InformationalBanner from "./InformationalBanner";
import Header from "./Header";
import dynamic from "next/dynamic";

const PdfView = dynamic(() => import('./PdfView'), {
  ssr: false,
  loading: () => <p>Loading PDF viewer...</p>, // Optional: Add a loading indicator
});

interface BasePDF {
    url: string,
    key: string,
}

interface UploadedPDF extends BasePDF{
    type: 'uploaded';
}

interface ListedPDF extends BasePDF {
    type: 'listed';
    name: string;
    text: string[];
}

// type PDF = UploadedPDF | ListedPDF;



interface PdfProps {
    uploadPdf: (
        pdf: FormData
    ) => Promise<{ success: boolean; response?: UploadedPDF; error?: string; }>;
    uploadPdfMetadata: (
        userId: string,
        pdf_key: string,
        pdf_name: string,
        pdf_url: string,
        pdf_text: string[]
    ) => Promise<{ success: boolean; response?: boolean; error?: string; }>;
    listPdfs: (
        userId: string,
    ) => Promise<{ success: boolean; response?: ListedPDF[]; error?: string; }>;
    deletePdf: (
        id: string,
    ) => Promise<{ success: boolean; response?: string; error?: string }>;
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
    uploadPdf: PdfProps["uploadPdf"];
    uploadPdfMetadata: PdfProps["uploadPdfMetadata"];
    listPdfs: PdfProps["listPdfs"];
    convertTextToSpeech: AudioProps["convertTextToSpeech"];
    deletePdf: PdfProps["deletePdf"];
}


export default function Dashboard({ uploadPdf, uploadPdfMetadata, listPdfs, convertTextToSpeech, deletePdf }: DashboardProps){
    const { user, isSignedIn, isLoaded } = useUser();
    const [numPages, setNumPages] = useState<number>();
    const [pageNumber, setPageNumber] = useState<number>();
    const [pdfName, setPdfName] = useState<string>('');
    // const [data, setData] = useState<File | null>(null);
    const [pdfFile, setPdfFile] = useState<string | null>(null);

     // state for text extraction
    const [pagesText, setPagesText] = useState<string[]>([]);

    const [userPdfs, setUserPdfs] = useState<ListedPDF[]>([]);

    const [popUpActive, setPopUpActive] = useState<boolean>(false);
    const [isLoadingPdfs, setIsLoadingPdfs] = useState<boolean>(false);

    const [pdfView, setPdfView] = useState<boolean>(false);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);

    const loadPdfs = async (userId: string | undefined) => {
        if(!userId) return;

        setIsLoadingPdfs(true);

        try {
            const response = await listPdfs(userId);
            if(response.success && response.response && response.response.length > 0){
                    setUserPdfs(response.response);
            } else {
                setUserPdfs([]);
            }
        } catch (error) {
            console.error("Error loading PDFs: ", error);
        } finally {
            setIsLoadingPdfs(false);
        }
    }

    useEffect(() => {
        // Clear PDFs immediately on sign-out
        if (!isSignedIn && isLoaded) {
            setUserPdfs([]);
            return;
        }
        // Load PDFs when user signs in and isLoaded

        if (user && isSignedIn && isLoaded) {
            loadPdfs(user.id);
        }

    },[user, isSignedIn, isLoaded]);


    useEffect(() => {
        console.log("len of userPdfs: ", userPdfs.length);
    }, [userPdfs]);


    const deleteOnClick = async (id: string) => {
        if (!id) return;
        try {
            const response = await deletePdf(id);
            
            if (!response.success) {
                console.error("Error: ", response.error);
                return;
            }

            const result = response.response;
            console.log("Result: ", result);

            const newListedPdfs = userPdfs.filter(pdf => pdf.key !== id);
            setUserPdfs(newListedPdfs);

        } catch (error) {
            console.error("Error: ", error);
        }
    }

    return (<div className="min-h-screen bg-black text-white">
        {/* Top Banner */}
        <InformationalBanner />
        
        <div className="flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Header popUpActive={popUpActive} setPdfView={setPdfView} />
            {(!pdfFile || !pdfView) ? (
                <div className="space-y-8">
                    <FileUploader setPopUpActive={setPopUpActive} uploadPdf={uploadPdf} uploadPdfMetadata={uploadPdfMetadata} setPdfFile={setPdfFile} setPdfName={setPdfName} setPagesText={setPagesText} userPdfs={userPdfs} setPdfView={setPdfView} setUserPdfs={setUserPdfs} />
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">PDF Selection</h2>
                            <Button variant="ghost" className="text-zinc-400 hover:text-white">
                            View all
                            </Button>
                        </div>
                        <PdfListView userPdfs={userPdfs} isLoadingPdfs={isLoadingPdfs} isLoaded={isLoaded} isDeleteDialogOpen={isDeleteDialogOpen} setIsDeleteDialogOpen={setIsDeleteDialogOpen} setPdfFile={setPdfFile} setPagesText={setPagesText} setNumPages={setNumPages} setPdfName={setPdfName} setPageNumber={setPageNumber} setPdfView={setPdfView} deleteOnClick={deleteOnClick} />
                    </div>
                </div>
            ) : (
                <PdfView setPdfView={setPdfView} pdfName={pdfName} numPages={numPages || 1} pdfFile={pdfFile} pagesText={pagesText} convertTextToSpeech={convertTextToSpeech} setNumPages={setNumPages} pageNumber={pageNumber || 1} setPageNumber={setPageNumber} />
            )}
        </div>
  </div>);
}