import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

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
      apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    } catch (e) {
      console.warn('Error accessing process.env or import.meta.env:', e);
      // @ts-ignore
      apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
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
      ? `您是一位聪明的马来西亚旅游规划师。请根据用户输入创建个性化的旅游行程。不要使用星号 (*) 或井号 (#) 等 markdown 字符。仅使用纯文本。`
      : `You are a smart Malaysia travel planner. Create a personalized travel itinerary based on user input. Do NOT use markdown characters like asterisks (*) or hashtags (#). Use plain text only.`;

    const userPrompt = isChinese 
      ? `目的地：${destination}，天数：${days}，旅行风格：${styleLabel}。请生成行程。`
      : `Destination: ${destination}, Days: ${days}, Style: ${styleLabel}. Please generate the itinerary.`;

    const modelName = "gemini-3-flash-preview";
    console.log('Generating itinerary with model:', modelName);
    
    let response;
    
    const callWithTimeout = async (model: string, prompt: string, instruction: string, timeoutMs: number, thinking: boolean = false) => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`AI Request Timeout (${timeoutMs/1000}s)`)), timeoutMs)
      );
      
      const config: any = {
        systemInstruction: instruction,
        maxOutputTokens: 2048
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
      console.log('Attempting with gemini-3-flash-preview...');
      debugOverlay.textContent = 'Planner Script: Calling Gemini 3 (30s)...';
      response = await callWithTimeout("gemini-3-flash-preview", userPrompt, systemInstruction, 30000, true);
    } catch (e1: any) {
      console.warn('gemini-3-flash-preview failed:', e1);
      debugOverlay.textContent = 'G3 Error: ' + (e1.message || 'Failed');
      debugOverlay.style.background = 'rgba(255,165,0,0.7)';
      
      try {
        console.log('Attempting with gemini-flash-latest...');
        debugOverlay.textContent = 'Planner Script: Calling Flash Latest (20s)...';
        response = await callWithTimeout("gemini-flash-latest", userPrompt, systemInstruction, 20000);
      } catch (e2: any) {
        console.warn('gemini-flash-latest failed:', e2);
        debugOverlay.textContent = 'Flash Error: ' + (e2.message || 'Failed');
        
        try {
          console.log('Attempting with gemini-3.1-flash-lite-preview...');
          debugOverlay.textContent = 'Planner Script: Calling Flash Lite (15s)...';
          response = await callWithTimeout("gemini-3.1-flash-lite-preview", userPrompt, systemInstruction, 15000);
        } catch (e3: any) {
          console.warn('gemini-3.1-flash-lite-preview failed:', e3);
          debugOverlay.textContent = 'Lite Error: ' + (e3.message || 'Failed');
          throw e3; // Re-throw to be caught by outer catch
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
    // We use html2canvas to capture the itinerary as an image to support Chinese characters in PDF
    const canvas = await (html2canvas as any)(itineraryOutput, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      logging: false,
      backgroundColor: '#f7f8fa' // Match var(--bg)
    });

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(10, 29, 55); // Navy color
    doc.text(isChinese ? "您的马来西亚旅游行程" : "Your Malaysia Travel Itinerary", margin, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${isChinese ? "生成日期" : "Generated on"}: ${new Date().toLocaleDateString()}`, margin, 28);

    // Add the captured image
    let yPos = 35;
    
    // If the image is longer than one page, we might need to handle it.
    // However, for most itineraries, it should fit or we can just put it on one page if it's not too long.
    // A better way is to split the canvas if needed, but let's start with a simple approach.
    if (yPos + imgHeight > pageHeight - 20) {
      // If it's too long, we scale it down to fit one page for now, 
      // or we could split it. Let's try to fit it first.
      const scaleFactor = (pageHeight - yPos - 20) / imgHeight;
      if (scaleFactor < 0.5) {
        // If it's really long, we just put it and it might overflow.
        // In a real app, we'd split the canvas into multiple images.
        doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
      } else {
        doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight * scaleFactor);
      }
    } else {
      doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
    }

    addFooter(doc, pageWidth, pageHeight, isChinese);
    doc.save(`S9Trip-Itinerary-${destinationInput.value || 'Malaysia'}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert(isChinese ? "生成 PDF 时出错。" : "Error generating PDF.");
  } finally {
    downloadPdfBtn.textContent = originalBtnText;
    downloadPdfBtn.disabled = false;
  }
});

function addFooter(doc: jsPDF, pageWidth: number, pageHeight: number, isChinese: boolean) {
  const footerY = pageHeight - 15;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(198, 162, 75); // Gold color from CSS
  doc.text(isChinese ? "S9Trip - 马来西亚导游与数字游民" : "S9Trip - Malaysia Tourist Guide & Digital Nomad", pageWidth / 2, footerY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text("www.s9trip.com | Real Experiences, Real People", pageWidth / 2, footerY + 5, { align: "center" });
}
