"use client";
import React, { useState, useEffect, useRef } from "react";
import { DrawIoEmbed } from "react-drawio";
import { CollapsibleChatPanel } from "@/components/collapsible-chat-panel";
import { useDiagram } from "@/contexts/diagram-context";
import { Button } from "@/components/ui/button";
import { Upload, Download } from "lucide-react";
import { extractDiagramXML } from "@/lib/utils";

export default function Home() {
  const { drawioRef, handleDiagramExport, importDiagramFile, exportDiagramFile, chartXML, exportPurpose } = useDiagram();
  const [isMobile, setIsMobile] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isDrawIoLoaded, setIsDrawIoLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importDiagramFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleDrawioLoad = (data: any) => {
    console.log('Draw.io loaded:', data);
    setIsDrawIoLoaded(true);
  };

  const handleDrawioExport = (data: any) => {
    const exportPurposeFromAttr = document.body.getAttribute('data-export-purpose');
    const isFileExport = exportPurpose === 'file' || exportPurposeFromAttr === 'file';

    handleDiagramExport(data);

    if (isFileExport) {
      try {
        const xmlContent = extractDiagramXML(data.data);
        const blob = new Blob([xmlContent], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diagram.drawio`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 0);
      } catch (error) {
        console.error("Error exporting diagram:", error);
        if (chartXML) {
          const blob = new Blob([chartXML], { type: 'application/xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `diagram.drawio`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 0);
        }
      }
    }
  };

  if (isMobile) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold text-gray-800">
            请在桌面或笔记本电脑上打开此应用
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className={`h-full p-1 transition-all duration-300 ${isChatCollapsed ? 'w-full' : 'w-3/4'}`}>
        <div className="h-full flex flex-col relative">
          {isDrawIoLoaded && (
            <div className="absolute top-2.5 right-20 z-10 flex gap-2 animate-in fade-in duration-300">
              <Button
                onClick={triggerFileInput}
                variant="secondary"
                size="sm"
                className="h-7.5 bg-[#c2e7ff] hover:bg-[#abcfe7]/90 text-[#3F3F3F] shadow-sm rounded-[4px]"
                title="导入 .drawio 文件"
              >
                <Upload className="h-3 w-3 mr-1" />
                <span className="text-xs" style={{ fontSize: '14px' }}>导入</span>
              </Button>
              <Button
                onClick={exportDiagramFile}
                variant="secondary"
                size="sm"
                className="h-7.5 bg-[#c2e7ff] hover:bg-[#abcfe7]/90 text-[#3F3F3F] shadow-sm rounded-[4px]"
                title="导出为 .drawio 文件"
              >
                <Download className="h-3 w-3 mr-1" />
                <span className="text-xs" style={{ fontSize: '14px' }}>导出</span>
              </Button>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".drawio,.xml"
          />

          <div className="flex-1">
            <DrawIoEmbed
              ref={drawioRef}
              onLoad={handleDrawioLoad}
              onExport={handleDrawioExport}
              urlParameters={{
                ui: "simple",
                spin: true,
                libraries: false,
                noSaveBtn: true,
                saveAndExit: false,
                noExitBtn: true,
                grid: true,
              }}
            />
          </div>
        </div>
      </div>

      {/* 关键修复：把 drawioRef 传给聊天面板！ */}
      <div className={`h-full p-1 transition-all duration-300 ${isChatCollapsed ? 'w-0' : 'w-1/4'}`}>
        <CollapsibleChatPanel 
          type="drawio" 
          onCollapseChange={setIsChatCollapsed}
          drawioRef={drawioRef}  // ← 这行是灵魂！
        />
      </div>
    </div>
  );
}
