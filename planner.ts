import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const downloadPdfBtn = document.getElementById('download-pdf-btn') as HTMLButtonElement;
const plannerActions = document.getElementById('planner-actions');
const destinationInput = document.getElementById('destination') as HTMLInputElement;
const daysInput = document.getElementById('days') as HTMLInputElement;
const styleSelect = document.getElementById('style') as HTMLSelectElement;
const loadingSpinner = document.getElementById('planner-loading');
const itineraryOutput = document.getElementById('itinerary-output');

let currentItinerary = "";

generateBtn?.addEventListener('click', async () => {
  const destination = destinationInput.value.trim();
  const days = daysInput.value;
  const style = styleSelect.value;

  if (!destination) {
    const isChinese = document.documentElement.lang === 'zh-Hans';
    alert(isChinese ? '请输入目的地。' : 'Please enter a destination.');
    return;
  }

  loadingSpinner!.style.display = 'block';
  itineraryOutput!.style.display = 'none';
  plannerActions!.style.display = 'none';
  itineraryOutput!.textContent = '';

  try {
    const isChinese = document.documentElement.lang === 'zh-Hans';
    
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

    const prompt = isChinese 
      ? `您是一位聪明的马来西亚旅游规划师。
请根据以下输入创建个性化的旅游行程：
- 目的地：${destination}
- 天数：${days}
- 旅行风格：${styleLabel}

说明：
1. 使用简单的句子生成一个简单、现实的逐日行程。
2. 重要提示：输出中不要使用星号 (*) 或井号 (#) 等 markdown 字符。仅使用纯文本。
3. 包括：
   - 早、午、晚计划
   - 热门景点 + 每天 1 个隐藏宝藏
   - 美食推荐
4. 保持旅行路线高效（附近的地点放在一起）。
5. 避免行程过于拥挤。
6. 除非另有说明，否则默认为中等预算。
7. 使其对马来西亚的旅行者实用（天气、交通、时间安排）。
8. 请使用中文回答。

输出格式（纯文本，无 * 或 #）：

行程摘要：
目的地：[目的地名称]
持续时间：[天数]
旅行风格：[风格]

第 1 天：
早上：[活动]
下午：[活动]
晚上：[活动]
美食：[推荐]

第 2 天：
...

温馨提示：
- 最佳出门时间
- 交通建议
- 简单的本地建议

保持简洁、有用，并且在没有任何特殊符号的情况下非常易于阅读。`
      : `You are a smart Malaysia travel planner.
Create a personalized travel itinerary based on the following input:
- Destination: ${destination}
- Number of days: ${days}
- Travel style: ${styleLabel}

Instructions:
1. Generate a simple, realistic day-by-day itinerary using simple sentences.
2. IMPORTANT: Do NOT use markdown characters like asterisks (*) or hashtags (#) in the output. Use plain text only.
3. Include:
   - Morning, afternoon, evening plan
   - Popular attractions + 1 hidden gem per day
   - Food recommendations
4. Keep travel routes efficient (nearby places together).
5. Avoid overpacking the schedule.
6. Default to mid-range budget unless stated otherwise.
7. Make it practical for travelers in Malaysia (weather, traffic, timing).

Output format (Plain Text, No * or #):

Trip Summary:
Destination: [Destination Name]
Duration: [Number of Days]
Travel Style: [Style]

Day 1:
Morning: [Activity]
Afternoon: [Activity]
Evening: [Activity]
Food: [Recommendation]

Day 2:
...

Quick Tips:
- Best time to go out
- Transport suggestion
- Simple local advice

Keep it concise, useful, and very easy to read without any special symbols.`;

    const response = await fetch('/api/generate-itinerary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate itinerary');
    }

    const data = await response.json();
    currentItinerary = data.text || "Sorry, I couldn't generate an itinerary. Please try again.";
    
    if (itineraryOutput) {
      itineraryOutput.textContent = currentItinerary;
      itineraryOutput.style.display = 'block';
    }
    if (plannerActions) {
      plannerActions.style.display = 'flex';
    }
  } catch (error: any) {
    console.error('AI Error:', error);
    if (itineraryOutput) {
      itineraryOutput.textContent = isChinese 
        ? '生成行程时出错，请稍后再试。' 
        : 'An error occurred while generating your itinerary. Please try again later.';
      itineraryOutput.style.display = 'block';
    }
  } finally {
    loadingSpinner!.style.display = 'none';
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
