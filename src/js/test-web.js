document.addEventListener('DOMContentLoaded', () => {
            feather.replace();

            const apiKeyInput = document.getElementById('api-key');
            const descriptionInput = document.getElementById('description-input');
            const generateBtn = document.getElementById('generate-btn');
            const resultContent = document.getElementById('result-content');

            generateBtn.addEventListener('click', async () => {
                const apiKey = apiKeyInput.value.trim();
                const description = descriptionInput.value.trim();

                if (!apiKey) {
                    alert("Vui lòng nhập Gemini API Key.");
                    return;
                }
                if (!description) {
                    alert("Vui lòng nhập mô tả cho hình vẽ.");
                    return;
                }

                setLoadingState(true);
                resultContent.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div><p class="ml-4 text-slate-500">AI đang vẽ hình...</p></div>`;
                
                try {
                    // PROMPT ĐÃ ĐƯỢC CẬP NHẬT ĐỂ TỐI ƯU HÓA ĐỘ CHÍNH XÁC
                    const prompt = `Bạn là một chuyên gia LaTeX/TikZ, chuyên vẽ hình học không gian trên mặt phẳng 2D. Hãy tạo mã TikZ dựa trên mô tả sau.

**QUY TẮC BẮT BUỘC PHẢI TUÂN THEO:**
1.  **HỆ TRỤC TỌA ĐỘ 2D:** Tuyệt đối chỉ sử dụng tọa độ 2D (x,y). Để giả lập 3D, hãy dùng góc nhìn phối cảnh. Gợi ý: đặt một điểm đáy ở gốc (0,0), một điểm khác trên trục hoành (x,0), và các điểm còn lại một cách hợp lý để tạo chiều sâu.
2.  **NÉT KHUẤT VÀ NÉT THẤY:** Phân tích kỹ hình dạng để xác định cạnh nào bị che khuất và vẽ chúng bằng nét đứt \`\\draw[dashed]\`. Các cạnh thấy được vẽ bằng nét liền \`\\draw\`.
3.  **ĐẦY ĐỦ CÁC LỆNH:** Mã phải bao gồm cả lệnh \`\\coordinate\` để định nghĩa điểm, lệnh \`\\draw\` để vẽ cạnh, và lệnh \`\\node\` để ghi tên TẤT CẢ các đỉnh.
4.  **ĐÁNH DẤU TÍNH CHẤT HÌNH HỌC:** Nếu mô tả có "vuông góc", "trung điểm", v.v., hãy thêm ký hiệu hình học tương ứng vào hình vẽ (ví dụ: ký hiệu góc vuông).
5.  **OUTPUT SẠCH:** Chỉ trả về phần mã nằm BÊN TRONG môi trường \`\\begin{tikzpicture}...\end{tikzpicture}\`. Không thêm bất kỳ văn bản, giải thích, hay các lệnh LaTeX nào khác.

**Mô tả:** "${description}"`;
                
                    const model = 'gemini-1.5-flash-latest';
                    const requestBody = {
                        contents: [{ parts: [{ text: prompt }] }]
                    };
                
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(`API Error: ${errorData.error.message}`);
                    }

                    const data = await response.json();
                    const tikzCode = data.candidates[0].content.parts[0].text
                        .replace(/```tikz|```|latex/g, '')
                        .replace(/\\begin{tikzpicture}|\\end{tikzpicture}/g, '')
                        .trim();
                    
                    renderResult(tikzCode);

                } catch (error) {
                    console.error("Error:", error);
                    resultContent.innerHTML = `<div class="text-red-600"><p class="font-bold">Đã xảy ra lỗi:</p><p class="mt-2 text-sm">${error.message}</p></div>`;
                } finally {
                    setLoadingState(false);
                }
            });

            function renderResult(tikzCode) {
                resultContent.innerHTML = `
                    <div>
                        <h3 class="text-md font-semibold text-slate-700">Hình ảnh trực quan:</h3>
                        <div class="my-4 p-4 border rounded-lg flex justify-center items-center min-h-[200px]">
                            <script type="text/tikz">
                                \\begin{tikzpicture}[scale=0.8]
                                    ${tikzCode}
                                \\end{tikzpicture}
                            <\/script>
                        </div>
                    </div>
                    <div class="mt-4">
                        <h3 class="text-md font-semibold text-slate-700">Mã TikZ:</h3>
                        <textarea readonly class="w-full mt-2 p-3 font-mono text-sm bg-slate-50 border rounded-lg h-40">${tikzCode}</textarea>
                    </div>
                `;
                if (window.tikzjax) {
                    const scripts = resultContent.querySelectorAll('script[type="text/tikz"]');
                    window.tikzjax.process(scripts);
                }
            }

            function setLoadingState(isLoading) {
                generateBtn.disabled = isLoading;
                const btnText = generateBtn.querySelector('span');
                if (isLoading) {
                    btnText.textContent = 'Đang vẽ...';
                } else {
                    btnText.textContent = 'Vẽ hình';
                }
            }
        });