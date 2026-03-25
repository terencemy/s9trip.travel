import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { db } from "./src/firebase";
import { collection, addDoc, getDoc, doc, serverTimestamp } from "firebase/firestore";

console.log('Planner script loaded. Lang:', document.documentElement.lang);
console.log('GoogleGenAI import type:', typeof GoogleGenAI);
console.log('ThinkingLevel import type:', typeof ThinkingLevel);

const isChinese = document.documentElement.lang === 'zh-Hans';

// Visible debug overlay for the user to confirm script is running
const debugOverlay = document.createElement('div');
debugOverlay.id = 'planner-debug-overlay';
debugOverlay.style.cssText = 'position:fixed;bottom:10px;right:10px;background:rgba(0,0,0,0.7);color:white;padding:5px 10px;border-radius:5px;font-size:12px;z-index:10000;pointer-events:none;';
debugOverlay.textContent = 'Planner Script: Loaded';
document.body.appendChild(debugOverlay);

const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const downloadPdfBtn = document.getElementById('download-pdf-btn') as HTMLButtonElement;
const plannerActions = document.getElementById('planner-actions');
const destinationInput = document.getElementById('destination') as HTMLInputElement;
const daysInput = document.getElementById('days') as HTMLInputElement;
const styleSelect = document.getElementById('style') as HTMLSelectElement;
const loadingSpinner = document.getElementById('planner-loading');
const itineraryOutput = document.getElementById('itinerary-output');

if (generateBtn) {
  debugOverlay.textContent += ' | Button: OK';
} else {
  debugOverlay.textContent += ' | Button: MISSING';
  debugOverlay.style.background = 'rgba(255,0,0,0.7)';
}

function showUIError(msg: string) {
  debugOverlay.textContent = 'Error: ' + msg;
  debugOverlay.style.background = 'rgba(255,0,0,0.7)';
  if (itineraryOutput) {
    itineraryOutput.textContent = msg;
    itineraryOutput.style.display = 'block';
    itineraryOutput.style.color = 'red';
  } else {
    console.error('UI Error:', msg);
  }
}

console.log('Elements found:', {
  generateBtn: !!generateBtn,
  downloadPdfBtn: !!downloadPdfBtn,
  plannerActions: !!plannerActions,
  destinationInput: !!destinationInput,
  daysInput: !!daysInput,
  styleSelect: !!styleSelect,
  loadingSpinner: !!loadingSpinner,
  itineraryOutput: !!itineraryOutput
});

if (!generateBtn) {
  showUIError(isChinese ? '找不到生成按钮。' : 'Generate button not found.');
}

let currentItinerary = "";

generateBtn?.addEventListener('click', async () => {
  console.log('Generate button clicked');
  
  if (!destinationInput || !daysInput || !styleSelect) {
    showUIError(isChinese ? '表单元素缺失。' : 'Form elements missing.');
    return;
  }

  const destination = destinationInput.value.trim();
  const days = daysInput.value;
  const style = styleSelect.value;

  console.log('Inputs:', { destination, days, style, isChinese });

  if (!destination) {
    alert(isChinese ? '请输入目的地。' : 'Please enter a destination.');
    return;
  }

  if (loadingSpinner) loadingSpinner.style.display = 'block';
  if (itineraryOutput) {
    itineraryOutput.style.display = 'none';
    itineraryOutput.textContent = '';
    itineraryOutput.style.color = 'inherit';
  }
  if (plannerActions) plannerActions.style.display = 'none';
  debugOverlay.textContent = 'Planner Script: Generating...';
  debugOverlay.style.background = 'rgba(0,120,255,0.7)';

  try {
    let apiKey = '';
    try {
      // @ts-ignore
      apiKey = (typeof process !== 'undefined' && (process.env?.MY_API_KEY || process.env?.GEMINI_API_KEY)) || 
               (import.meta as any).env?.VITE_MY_API_KEY || 
               (import.meta as any).env?.VITE_GEMINI_API_KEY;
    } catch (e) {
      console.warn('Error accessing process.env or import.meta.env:', e);
      // @ts-ignore
      apiKey = (import.meta as any).env?.VITE_MY_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    }

    console.log('Frontend API Key present:', !!apiKey);
    if (apiKey && typeof apiKey === 'string') {
      console.log('Frontend API Key prefix:', apiKey.substring(0, 4));
    }
    
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey === '') {
      throw new Error(isChinese ? 'API 密钥缺失，请检查环境设置。' : 'API Key is missing. Please check your environment settings.');
    }

    console.log('Initializing GoogleGenAI...');
    if (typeof GoogleGenAI !== 'function') {
      throw new Error('GoogleGenAI is not a constructor. Type: ' + typeof GoogleGenAI);
    }
    const ai = new GoogleGenAI({ apiKey });
    console.log('GoogleGenAI initialized');
    debugOverlay.textContent = 'Planner Script: Initialized | AI: OK';

    const styleMap: Record<string, string> = isChinese ? {
      relax: '休闲',
      food: '美食',
      adventure: '冒险',
      shopping: '购物'
    } : {
      relax: 'Relax',
      food: 'Foodie',
      adventure: 'Adventure',
      shopping: 'Shopping'
    };
    const styleLabel = styleMap[style] || style;

    const systemInstruction = isChinese 
      ? `您是一位专业的马来西亚旅游规划师。请为用户生成一份详细且实用的中文旅游行程。
格式要求：
1. 仅使用纯文本，严禁使用任何 Markdown 符号（如 #, *, -, **）。
2. 每日行程请以 "第 X 天：" 开头。
3. 每日包含：上午、下午、晚上。
4. 包含具体景点名称。
5. 总长度请控制在 1500 字以内。`
      : `You are a professional Malaysia travel planner. Create a detailed and practical travel itinerary.
Format requirements:
1. Use plain text only. Strictly NO Markdown symbols (like #, *, -, **).
2. Start each day with "Day X:".
3. Include Morning, Afternoon, and Evening activities.
4. Include specific attraction names.
5. Keep the total length under 1500 words.`;

    const userPrompt = isChinese 
      ? `请为我规划去 ${destination} 的行程，共 ${days} 天，风格是 ${styleLabel}。请提供每日详细安排。`
      : `Please plan a ${days}-day ${styleLabel} trip to ${destination}. Provide a detailed daily schedule.`;

    const modelName = "gemini-3-flash-preview";
    console.log('Generating itinerary with model:', modelName);
    
    let response;
    
    const callWithTimeout = async (model: string, prompt: string, instruction: string, timeoutMs: number, thinking: boolean = false) => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`AI Request Timeout (${timeoutMs/1000}s)`)), timeoutMs)
      );
      
      const config: any = {
        systemInstruction: instruction,
        maxOutputTokens: 4096
      };
      
      if (thinking) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      
      const aiCall = ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config
      });
      
      return await Promise.race([aiCall, timeoutPromise]) as any;
    };

    try {
      if (isChinese) {
        console.log('Attempting with gemini-3.1-flash-lite-preview (Primary for Chinese)...');
        debugOverlay.textContent = 'Planner Script: Calling Flash Lite (30s)...';
        response = await callWithTimeout("gemini-3.1-flash-lite-preview", userPrompt, systemInstruction, 30000);
      } else {
        console.log('Attempting with gemini-3-flash-preview...');
        debugOverlay.textContent = 'Planner Script: Calling Gemini 3 (30s)...';
        response = await callWithTimeout("gemini-3-flash-preview", userPrompt, systemInstruction, 30000);
      }
    } catch (e1: any) {
      console.warn('Primary model failed:', e1);
      debugOverlay.textContent = 'Primary Error: ' + (e1.message || 'Failed');
      debugOverlay.style.background = 'rgba(255,165,0,0.7)';
      
      try {
        const fallbackModel = isChinese ? "gemini-3-flash-preview" : "gemini-flash-latest";
        console.log(`Attempting with fallback: ${fallbackModel}...`);
        debugOverlay.textContent = `Planner Script: Calling ${fallbackModel} (20s)...`;
        response = await callWithTimeout(fallbackModel, userPrompt, systemInstruction, 20000);
      } catch (e2: any) {
        console.warn('First fallback failed:', e2);
        debugOverlay.textContent = 'Fallback Error: ' + (e2.message || 'Failed');
        
        try {
          const finalFallback = isChinese ? "gemini-flash-latest" : "gemini-3.1-flash-lite-preview";
          console.log(`Attempting with final fallback: ${finalFallback}...`);
          debugOverlay.textContent = `Planner Script: Calling ${finalFallback} (15s)...`;
          response = await callWithTimeout(finalFallback, userPrompt, systemInstruction, 15000);
        } catch (e3: any) {
          console.warn('Final fallback failed:', e3);
          debugOverlay.textContent = 'Final Error: ' + (e3.message || 'Failed');
          throw e3;
        }
      }
    }

    console.log('AI Response received:', !!response);
    if (!response) {
      throw new Error(isChinese ? '未收到 AI 响应。' : 'No AI response received.');
    }
    const text = response.text;
    console.log('AI Response text length:', text?.length || 0);
    debugOverlay.textContent = 'Planner Script: Success';
    debugOverlay.style.background = 'rgba(0,200,0,0.7)';
    
    if (itineraryOutput) {
      itineraryOutput.style.display = 'block';
      if (text) {
        itineraryOutput.textContent = text;
        currentItinerary = text;
        if (plannerActions) plannerActions.style.display = 'flex';
        debugOverlay.textContent = 'Planner Script: Success';
        debugOverlay.style.background = 'rgba(0,255,0,0.7)';
      } else {
        itineraryOutput.textContent = isChinese ? '抱歉，无法生成行程。请再试一次。' : "Sorry, I couldn't generate an itinerary. Please try again.";
        debugOverlay.textContent = 'Planner Script: Empty Response';
      }
    }
  } catch (error: any) {
    console.error('AI Error:', error);
    
    let errorMsg = error.message || 'Unknown error';
    if (errorMsg.includes('API_KEY_INVALID')) {
      errorMsg = isChinese ? 'API 密钥无效。' : 'Invalid API Key.';
    } else if (errorMsg.includes('QUOTA_EXCEEDED')) {
      errorMsg = isChinese ? '配额已耗尽，请稍后再试。' : 'Quota exceeded. Please try again later.';
    }

    showUIError((isChinese ? '生成行程时出错：' : 'An error occurred: ') + errorMsg);
  } finally {
    if (loadingSpinner) loadingSpinner.style.display = 'none';
  }
});

downloadPdfBtn?.addEventListener('click', async () => {
  if (!currentItinerary || !itineraryOutput) return;

  const isChinese = document.documentElement.lang === 'zh-Hans';
  const loadingText = isChinese ? "正在准备 PDF..." : "Preparing PDF...";
  const originalBtnText = downloadPdfBtn.textContent;
  downloadPdfBtn.textContent = loadingText;
  downloadPdfBtn.disabled = true;

  try {
    // Create a temporary container for the PDF content to ensure all Chinese characters are rendered correctly
    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '0';
    printContainer.style.width = '850px'; // Slightly wider for better proportions
    printContainer.style.padding = '60px';
    printContainer.style.background = '#ffffff';
    printContainer.style.color = '#1f2937';
    printContainer.style.fontFamily = '"Inter", "PingFang SC", "Microsoft YaHei", sans-serif';

    // Header Section for alignment
    const header = document.createElement('div');
    header.style.marginBottom = '40px';
    header.style.borderBottom = '1px solid #e5e7eb';
    header.style.paddingBottom = '20px';

    const title = document.createElement('h1');
    title.style.fontSize = '32px';
    title.style.color = '#0a1d37';
    title.style.margin = '0 0 12px 0';
    title.style.fontFamily = '"Playfair Display", serif';
    title.style.fontWeight = '700';
    title.textContent = isChinese ? "您的马来西亚旅游行程" : "Your Malaysia Travel Itinerary";
    header.appendChild(title);

    const date = document.createElement('p');
    date.style.fontSize = '16px';
    date.style.color = '#6b7280';
    date.style.margin = '0';
    date.textContent = `${isChinese ? "生成日期" : "Generated on"}: ${new Date().toLocaleDateString()}`;
    header.appendChild(date);
    
    printContainer.appendChild(header);

    const content = document.createElement('div');
    content.style.whiteSpace = 'pre-wrap';
    content.style.fontSize = '18px';
    content.style.lineHeight = '1.7';
    content.style.padding = '40px';
    content.style.background = '#f9fafb';
    content.style.borderRadius = '12px';
    content.style.borderLeft = '8px solid #c6a24b';
    content.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
    content.textContent = currentItinerary;
    printContainer.appendChild(content);

    // Removed the HTML footer to prevent double-branding on the last page
    // Branding is now handled exclusively by the jsPDF addFooterBranding function

    document.body.appendChild(printContainer);

    // Capture the entire container
    const canvas = await (html2canvas as any)(printContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Remove the temporary container
    document.body.removeChild(printContainer);

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const margin = 15; // Increased margin for better look
    const footerAreaHeight = 30; // Increased footer area
    const effectivePageHeight = pageHeight - (margin * 2) - footerAreaHeight; 
    
    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const addFooterBranding = (pdfDoc: jsPDF) => {
      const footerY = pageHeight - 15;
      // Draw a white rectangle to cover any image overflow behind the footer
      pdfDoc.setFillColor(255, 255, 255);
      pdfDoc.rect(0, pageHeight - footerAreaHeight, pageWidth, footerAreaHeight, 'F');
      
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(10, 29, 55); // Navy
      pdfDoc.text("Curated by S9Trip.com", pageWidth / 2, footerY, { align: "center" });
      
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(9);
      pdfDoc.setTextColor(156, 163, 175);
      pdfDoc.text("Travel smarter, travel seamlessly", pageWidth / 2, footerY + 5, { align: "center" });
    };

    const addHeaderMask = (pdfDoc: jsPDF) => {
      // Draw a white rectangle at the top to preserve the header margin on subsequent pages
      pdfDoc.setFillColor(255, 255, 255);
      pdfDoc.rect(0, 0, pageWidth, margin, 'F');
    };

    // Handle multi-page
    let heightLeft = imgHeight;
    let position = margin;
    let pageCount = 0;

    // First page
    doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    addFooterBranding(doc);
    // No header mask needed for first page as it has the real header
    heightLeft -= effectivePageHeight;

    // Subsequent pages
    while (heightLeft > 0) {
      pageCount++;
      doc.addPage();
      position = margin - (effectivePageHeight * pageCount);
      doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      addHeaderMask(doc); // Cover the bleed from previous page
      addFooterBranding(doc); // Cover the bleed into the footer
      heightLeft -= effectivePageHeight;
    }

    doc.save(`S9Trip-Itinerary-${destinationInput.value || 'Malaysia'}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert(isChinese ? "生成 PDF 时出错。" : "Error generating PDF.");
  } finally {
    downloadPdfBtn.textContent = originalBtnText;
    downloadPdfBtn.disabled = false;
  }
});

const getShareLinkBtn = document.getElementById('get-share-link-btn');
const shareLinkContainer = document.getElementById('share-link-container');
const shareLinkInput = document.getElementById('share-link-input') as HTMLInputElement;
const copyShareLinkBtn = document.getElementById('copy-share-link-btn');

// Check for shared itinerary on load
const urlParams = new URLSearchParams(window.location.search);
const sharedId = urlParams.get('share');
if (sharedId) {
  loadSharedItinerary(sharedId);
}

async function loadSharedItinerary(id: string) {
  if (loadingSpinner) loadingSpinner.style.display = 'block';
  debugOverlay.textContent = 'Planner Script: Loading shared itinerary...';
  
  try {
    const docRef = doc(db, "itineraries", id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      currentItinerary = data.content;
      if (itineraryOutput) {
        itineraryOutput.style.display = 'block';
        itineraryOutput.textContent = currentItinerary;
        if (plannerActions) {
          plannerActions.style.display = 'flex';
          plannerActions.style.flexWrap = 'wrap';
          plannerActions.style.justifyContent = 'center';
          plannerActions.style.gap = '10px';
        }
      }
      if (destinationInput) destinationInput.value = data.destination || '';
      debugOverlay.textContent = 'Planner Script: Shared itinerary loaded';
    } else {
      showUIError(isChinese ? '找不到分享的行程。' : 'Shared itinerary not found.');
    }
  } catch (error) {
    console.error('Error loading shared itinerary:', error);
    showUIError(isChinese ? '加载分享行程时出错。' : 'Error loading shared itinerary.');
  } finally {
    if (loadingSpinner) loadingSpinner.style.display = 'none';
  }
}

getShareLinkBtn?.addEventListener('click', async () => {
  if (!currentItinerary) return;
  
  const originalText = getShareLinkBtn.textContent;
  getShareLinkBtn.textContent = isChinese ? '正在生成链接...' : 'Generating link...';
  (getShareLinkBtn as HTMLButtonElement).disabled = true;
  
  try {
    const docRef = await addDoc(collection(db, "itineraries"), {
      content: currentItinerary,
      destination: destinationInput?.value || '',
      days: daysInput?.value || '',
      style: styleSelect?.value || '',
      lang: isChinese ? 'zh' : 'en',
      createdAt: serverTimestamp()
    });
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${docRef.id}`;
    if (shareLinkInput) shareLinkInput.value = shareUrl;
    if (shareLinkContainer) shareLinkContainer.style.display = 'block';
    
    if (shareLinkContainer) shareLinkContainer.scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    console.error('Error creating share link:', error);
    alert(isChinese ? '创建分享链接失败。' : 'Failed to create share link.');
  } finally {
    getShareLinkBtn.textContent = originalText;
    (getShareLinkBtn as HTMLButtonElement).disabled = false;
  }
});

copyShareLinkBtn?.addEventListener('click', () => {
  if (!shareLinkInput) return;
  shareLinkInput.select();
  navigator.clipboard.writeText(shareLinkInput.value).then(() => {
    const originalText = copyShareLinkBtn.textContent;
    copyShareLinkBtn.textContent = isChinese ? '已复制！' : 'Copied!';
    setTimeout(() => {
      copyShareLinkBtn.textContent = originalText;
    }, 2000);
  });
});
