import React, { useState, useRef } from "react";
import { UploadCloud, Camera, Check, RefreshCw, AlertCircle } from "lucide-react";
import { ReceiptScanResult, Transaction } from "../types";

interface ReceiptScannerProps {
  onScanComplete: (scannedTx: Omit<Transaction, "userId">) => void;
}

export default function ReceiptScanner({ onScanComplete }: ReceiptScannerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingQuotes = [
    "Aligning lasers to scan the merchant signature...",
    "Gemini is reading the blurry corner of your receipt...",
    "Summarizing line items and separating tax rates...",
    "Classifying purchase category based on merchant patterns...",
    "Validating total pricing totals with high mathematical accuracy..."
  ];

  function runLoadingCycle() {
    let index = 0;
    setLoadingMsg(loadingQuotes[0]);
    const interval = setInterval(() => {
      index++;
      if (index < loadingQuotes.length) {
        setLoadingMsg(loadingQuotes[index]);
      } else {
        clearInterval(interval);
      }
    }, 1500);
    return interval;
  }

  // Handle file reading
  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select or drop an image file (PNG, JPG, HEIC, etc.)");
      return;
    }
    setErrorMsg(null);
    setSuccess(false);
    setScanResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewSrc(reader.result as string);
      setMimeType(file.type);
    };
    reader.readAsDataURL(file);
  }

  // Drag and drop events
  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }

  function triggerFileSelect() {
    fileInputRef.current?.click();
  }

  // Server API Scan call
  async function triggerScan() {
    if (!previewSrc || !mimeType) return;
    setScanning(true);
    setErrorMsg(null);
    const cycle = runLoadingCycle();

    try {
      const base64Content = previewSrc.split(",")[1];
      const res = await fetch("/api/receipt/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Content, mimeType })
      });

      if (!res.ok) {
        throw new Error(`Failed to scan photo (Server Status: ${res.status})`);
      }

      const result: ReceiptScanResult = await res.json();
      setScanResult(result);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Visual OCR scanner was unable to read the receipt. Ensure standard brightness.");
    } finally {
      clearInterval(cycle);
      setScanning(false);
    }
  }

  // Add the expense to Ledger
  function handleConfirmSave() {
    if (!scanResult) return;
    
    const newTx: Omit<Transaction, "userId"> = {
      id: `receipt-${Date.now()}`,
      date: scanResult.date,
      amount: scanResult.amount,
      merchant: scanResult.merchant,
      category: scanResult.category,
      source: "Receipt Scan",
      rawText: scanResult.lines.join("\n"),
      createdAt: new Date().toISOString()
    };

    onScanComplete(newTx);
    setSuccess(true);
    setTimeout(() => {
      // Clear scanner after quick success flash to enable fresh uploading
      setPreviewSrc(null);
      setMimeType(null);
      setScanResult(null);
      setSuccess(false);
    }, 1500);
  }

  return (
    <div id="receipt-scanner-container" className="bg-white border border-slate-100 rounded-3xl shadow-xs p-6 space-y-6 hover:shadow-sm transition-all duration-300">
      
      <div className="flex justify-between items-center pb-2 border-b border-slate-50">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 font-display uppercase tracking-wider">
            <Camera className="w-4 h-4 text-blue-600 stroke-[2.5]" />
            Receipt Scanner
          </h2>
          <p className="text-xs text-slate-400 mt-1">Upload receipt photo to extract transactions using visual AI</p>
        </div>
      </div>

      {/* Upload Drop Zone / Preview */}
      {!previewSrc ? (
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
            dragActive 
              ? "border-blue-500 bg-blue-50/40 scale-[0.99]" 
              : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/30"
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileInputChange} 
            accept="image/*" 
            className="hidden" 
          />
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110">
            <UploadCloud className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-xs font-semibold text-slate-700 font-display">Drag & drop your receipt image here, or <span className="text-blue-600 font-bold hover:underline">browse</span></p>
          <p className="text-[10px] text-slate-400 mt-1.5">Supports JPEG, PNG, WEBP (Max 8MB)</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Image Display */}
          <div className="relative border border-slate-100 rounded-2xl overflow-hidden bg-slate-50 max-h-64 flex items-center justify-center p-2 group">
            <img src={previewSrc} alt="Receipt Preview" className="max-h-60 object-contain rounded-lg" />
            {!scanning && !scanResult && (
              <button 
                onClick={() => { setPreviewSrc(null); setScanResult(null); }}
                className="absolute top-3 right-3 bg-slate-900/85 hover:bg-slate-900 text-white rounded-xl px-3 py-1 text-xs font-semibold hover:scale-105 transition shadow-sm"
              >
                Change Photo
              </button>
            )}
          </div>

          {/* Side Controls / Scanning Result State */}
          <div className="flex flex-col justify-center space-y-4">
            {!scanning && !scanResult && (
              <div className="space-y-4">
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Image loaded successfully. Run AI classification to auto-classify categories, extract totals, and parse dates instantly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={triggerScan}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all duration-200 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                  Analyze Receipt Photo
                </button>
              </div>
            )}

            {scanning && (
              <div className="text-center py-8 space-y-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto shadow-xs" />
                <p className="text-xs font-semibold text-slate-600 leading-relaxed max-w-[220px] mx-auto min-h-12 font-display">{loadingMsg}</p>
              </div>
            )}

            {scanResult && !scanning && (
              <div className="space-y-4 bg-slate-50/65 p-5 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 tracking-wide uppercase font-display border-b border-slate-100 pb-2">AI Extracted Details</h4>
                
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex justify-between items-center border-b border-slate-100/60 pb-2">
                    <span className="text-slate-400 font-medium">Merchant</span>
                    <input 
                      type="text" 
                      value={scanResult.merchant}
                      onChange={e => setScanResult({ ...scanResult, merchant: e.target.value })}
                      className="font-bold text-slate-800 text-right bg-transparent border-none p-0 focus:ring-0 max-w-[150px] outline-none text-xs font-display" 
                    />
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100/60 pb-2">
                    <span className="text-slate-400 font-medium">Total Amount</span>
                    <div className="flex items-center gap-0.5 justify-end">
                      <span className="font-bold text-slate-800 font-mono text-xs">$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={scanResult.amount}
                        onChange={e => setScanResult({ ...scanResult, amount: parseFloat(e.target.value) || 0 })}
                        className="font-bold text-slate-800 text-right bg-transparent border-none p-0 focus:ring-0 max-w-[100px] outline-none font-mono text-xs" 
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100/60 pb-2">
                    <span className="text-slate-400 font-medium">Date</span>
                    <input 
                      type="date" 
                      value={scanResult.date}
                      onChange={e => setScanResult({ ...scanResult, date: e.target.value })}
                      className="font-semibold text-slate-800 text-right bg-transparent border-none p-0 focus:ring-0 max-w-[130px] outline-none text-xs font-mono" 
                    />
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100/65 pb-2">
                    <span className="text-slate-400 font-medium">Category</span>
                    <select
                      value={scanResult.category}
                      onChange={e => setScanResult({ ...scanResult, category: e.target.value })}
                      className="font-bold text-slate-800 text-right bg-transparent border-none p-0 focus:ring-0 text-xs font-display"
                    >
                      <option value="Groceries">Groceries</option>
                      <option value="Dining & Cafes">Dining & Cafes</option>
                      <option value="Rent & Housing">Rent & Housing</option>
                      <option value="Subscriptions & Bills">Subscriptions & Bills</option>
                      <option value="Transport & Travel">Transport & Travel</option>
                      <option value="Entertainment & Leisure">Entertainment & Leisure</option>
                      <option value="Shopping & Retail">Shopping & Retail</option>
                      <option value="Health & Fitness">Health & Fitness</option>
                      <option value="Miscellaneous">Miscellaneous</option>
                    </select>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1">
                    <span className="text-slate-400 font-medium">AI Confidence</span>
                    <span className={`font-bold font-mono ${scanResult.confidence >= 0.8 ? "text-blue-600" : "text-amber-500"}`}>
                      {(scanResult.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => { setScanResult(null); setPreviewSrc(null); }}
                    className="flex-1 py-2 px-3 border border-slate-200 text-slate-500 hover:bg-white rounded-xl text-xs font-semibold leading-5 transition"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleConfirmSave}
                    disabled={success}
                    className="flex-1 py-2 px-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold leading-5 flex items-center justify-center gap-1 shadow-sm transition"
                  >
                    {success ? <Check className="w-4 h-4" /> : "Approve Expense"}
                  </button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs flex items-start gap-2 border border-rose-100">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
