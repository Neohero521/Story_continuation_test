/**
 * 故事续写扩展 - 类似彩云小梦的功能
 * 用于在 SillyTavern 中生成故事的多个续写版本
 */

(function() {
    const MODULE_NAME = 'story_continuation';
    
    // 默认设置
    const defaultSettings = {
        enabled: true,
        generateCount: 3,
        continuationType: '后续',  // 前传、后续、番外
        maxTokens: 500,
        temperature: 0.8
    };

    // 获取设置
    function getSettings() {
        const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
        
        if (!extensionSettings[MODULE_NAME]) {
            extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
        }
        
        // 确保所有默认键存在
        for (const key of Object.keys(defaultSettings)) {
            if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
                extensionSettings[MODULE_NAME][key] = defaultSettings[key];
            }
        }
        
        return extensionSettings[MODULE_NAME];
    }

    // 加载设置时初始化
    const settings = getSettings();

    // 创建UI
    function createUI() {
        const container = document.createElement('div');
        container.id = 'story-continuation-panel';
        container.className = 'extension-panel';
        container.innerHTML = `
            <div class="story-continuation-header">
                <h3>📖 故事续写</h3>
                <button class="sc-close-btn" title="关闭">×</button>
            </div>
            <div class="story-continuation-content">
                <div class="sc-input-section">
                    <label>故事背景/开头:</label>
                    <textarea id="sc-story-input" placeholder="输入故事背景或选择当前聊天内容..." rows="4"></textarea>
                    <div class="sc-buttons">
                        <button id="sc-use-chat-btn" class="sc-btn secondary">使用当前聊天</button>
                    </div>
                </div>
                
                <div class="sc-options">
                    <div class="sc-option-group">
                        <label>续写方向:</label>
                        <div class="sc-radio-group" id="sc-continuation-type">
                            <label><input type="radio" name="continuation-type" value="前传" ${settings.continuationType === '前传' ? 'checked' : ''}> 前传</label>
                            <label><input type="radio" name="continuation-type" value="后续" ${settings.continuationType === '后续' ? 'checked' : ''}> 后续</label>
                            <label><input type="radio" name="continuation-type" value="番外" ${settings.continuationType === '番外' ? 'checked' : ''}> 番外</label>
                        </div>
                    </div>
                    
                    <div class="sc-option-group">
                        <label>生成数量:</label>
                        <select id="sc-generate-count">
                            <option value="2" ${settings.generateCount === 2 ? 'selected' : ''}>2 个</option>
                            <option value="3" ${settings.generateCount === 3 ? 'selected' : ''}>3 个</option>
                            <option value="4" ${settings.generateCount === 4 ? 'selected' : ''}>4 个</option>
                            <option value="5" ${settings.generateCount === 5 ? 'selected' : ''}>5 个</option>
                        </select>
                    </div>
                </div>
                
                <button id="sc-generate-btn" class="sc-btn primary">🚀 开始生成</button>
                
                <div id="sc-results" class="sc-results"></div>
                
                <div id="sc-loading" class="sc-loading" style="display: none;">
                    <div class="sc-spinner"></div>
                    <span>AI 正在续写故事...</span>
                </div>
            </div>
        `;
        
        return container;
    }

    // 注入样式
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #story-continuation-panel {
                position: fixed;
                right: 20px;
                top: 100px;
                width: 380px;
                max-height: 80vh;
                background: #2a2a2e;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                z-index: 1000;
                font-family: 'Segoe UI', Arial, sans-serif;
                color: #e0e0e0;
                overflow: hidden;
            }
            
            .story-continuation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #1a1a1e;
                border-bottom: 1px solid #3a3a3e;
            }
            
            .story-continuation-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .sc-close-btn {
                background: none;
                border: none;
                color: #888;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }
            
            .sc-close-btn:hover {
                color: #fff;
            }
            
            .story-continuation-content {
                padding: 16px;
                max-height: calc(80vh - 50px);
                overflow-y: auto;
            }
            
            .sc-input-section {
                margin-bottom: 16px;
            }
            
            .sc-input-section label {
                display: block;
                margin-bottom: 8px;
                font-size: 13px;
                color: #aaa;
            }
            
            #sc-story-input {
                width: 100%;
                padding: 10px;
                border: 1px solid #3a3a3e;
                border-radius: 8px;
                background: #1a1a1e;
                color: #e0e0e0;
                font-size: 14px;
                resize: vertical;
                box-sizing: border-box;
            }
            
            #sc-story-input:focus {
                outline: none;
                border-color: #6a6a8a;
            }
            
            .sc-buttons {
                margin-top: 8px;
            }
            
            .sc-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            }
            
            .sc-btn.primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                width: 100%;
                padding: 12px;
                font-size: 14px;
                font-weight: 600;
            }
            
            .sc-btn.primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            
            .sc-btn.primary:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .sc-btn.secondary {
                background: #3a3a3e;
                color: #aaa;
            }
            
            .sc-btn.secondary:hover {
                background: #4a4a4e;
                color: #fff;
            }
            
            .sc-options {
                display: flex;
                gap: 16px;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }
            
            .sc-option-group {
                flex: 1;
                min-width: 120px;
            }
            
            .sc-option-group > label {
                display: block;
                margin-bottom: 6px;
                font-size: 12px;
                color: #888;
            }
            
            .sc-radio-group {
                display: flex;
                gap: 8px;
            }
            
            .sc-radio-group label {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                cursor: pointer;
            }
            
            .sc-radio-group input[type="radio"] {
                accent-color: #667eea;
            }
            
            #sc-generate-count {
                width: 100%;
                padding: 6px;
                border: 1px solid #3a3a3e;
                border-radius: 6px;
                background: #1a1a1e;
                color: #e0e0e0;
                font-size: 13px;
            }
            
            .sc-results {
                margin-top: 16px;
            }
            
            .sc-story-card {
                background: #1a1a1e;
                border: 1px solid #3a3a3e;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                transition: all 0.2s;
            }
            
            .sc-story-card:hover {
                border-color: #667eea;
            }
            
            .sc-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .sc-card-number {
                font-size: 12px;
                color: #667eea;
                font-weight: 600;
            }
            
            .sc-card-actions {
                display: flex;
                gap: 6px;
            }
            
            .sc-card-btn {
                padding: 4px 10px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s;
            }
            
            .sc-card-btn.insert {
                background: #667eea;
                color: white;
            }
            
            .sc-card-btn.insert:hover {
                background: #764ba2;
            }
            
            .sc-card-btn.continue {
                background: #3a3a3e;
                color: #aaa;
            }
            
            .sc-card-btn.continue:hover {
                background: #4a4a4e;
            }
            
            .sc-card-content {
                font-size: 13px;
                line-height: 1.6;
                color: #ccc;
                white-space: pre-wrap;
                word-break: break-word;
            }
            
            .sc-loading {
                text-align: center;
                padding: 20px;
                color: #888;
            }
            
            .sc-spinner {
                width: 32px;
                height: 32px;
                margin: 0 auto 10px;
                border: 3px solid #3a3a3e;
                border-top-color: #667eea;
                border-radius: 50%;
                animation: sc-spin 1s linear infinite;
            }
            
            @keyframes sc-spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // 初始化
    function init() {
        injectStyles();
        
        const panel = createUI();
        document.body.appendChild(panel);
        
        // 绑定事件
        bindEvents(panel);
        
        // 添加菜单按钮
        addMenuButton();
    }

    // 绑定事件
    function bindEvents(panel) {
        // 关闭按钮
        panel.querySelector('.sc-close-btn').addEventListener('click', () => {
            panel.style.display = 'none';
        });
        
        // 使用当前聊天
        panel.querySelector('#sc-use-chat-btn').addEventListener('click', () => {
            const context = SillyTavern.getContext();
            const chat = context.chat;
            
            if (chat && chat.length > 0) {
                // 获取最近的几条消息作为上下文
                const recentMessages = chat.slice(-5).map(msg => {
                    const name = msg.name || (msg.is_user ? '用户' : context.characters[context.characterId]?.name || '角色');
                    return `${name}: ${msg.mes}`;
                }).join('\n\n');
                
                panel.querySelector('#sc-story-input').value = recentMessages;
            }
        });
        
        // 续写方向选择
        panel.querySelectorAll('input[name="continuation-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                settings.continuationType = e.target.value;
                SillyTavern.getContext().saveSettingsDebounced();
            });
        });
        
        // 生成数量
        panel.querySelector('#sc-generate-count').addEventListener('change', (e) => {
            settings.generateCount = parseInt(e.target.value);
            SillyTavern.getContext().saveSettingsDebounced();
        });
        
        // 生成按钮
        panel.querySelector('#sc-generate-btn').addEventListener('click', generateStories);
    }

    // 添加菜单按钮
    function addMenuButton() {
        // 等待SillyTavern菜单加载完成后添加按钮
        const checkMenu = setInterval(() => {
            const menuContainer = document.querySelector('.extensions-menu') || document.querySelector('#extensions .menu');
            if (menuContainer) {
                clearInterval(checkMenu);
                
                const btn = document.createElement('button');
                btn.className = 'menu-button';
                btn.textContent = '📖 故事续写';
                btn.addEventListener('click', () => {
                    const panel = document.getElementById('story-continuation-panel');
                    if (panel) {
                        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    }
                });
                
                menuContainer.appendChild(btn);
            }
        }, 1000);
    }

    // 生成故事
    async function generateStories() {
        const panel = document.getElementById('story-continuation-panel');
        const input = panel.querySelector('#sc-story-input').value.trim();
        const resultsContainer = panel.querySelector('#sc-results');
        const loading = panel.querySelector('#sc-loading');
        const generateBtn = panel.querySelector('#sc-generate-btn');
        
        if (!input) {
            alert('请输入故事背景或开头！');
            return;
        }
        
        // 显示加载状态
        loading.style.display = 'block';
        resultsContainer.innerHTML = '';
        generateBtn.disabled = true;
        
        try {
            const count = settings.generateCount;
            const type = settings.continuationType;
            const stories = [];
            
            // 生成多个版本
            for (let i = 0; i < count; i++) {
                const story = await generateSingleStory(input, type, i);
                stories.push(story);
            }
            
            // 显示结果
            displayResults(stories);
            
        } catch (error) {
            console.error('生成失败:', error);
            resultsContainer.innerHTML = `<div class="sc-error">生成失败: ${error.message}</div>`;
        } finally {
            loading.style.display = 'none';
            generateBtn.disabled = false;
        }
    }

    // 生成单个故事
    async function generateSingleStory(storyInput, type, index) {
        const context = SillyTavern.getContext();
        
        // 构建提示词
        const prompt = `请根据以下故事背景，续写一个${type}版本的故事。要求：
1. 故事要有逻辑性，与原背景契合
2. 字数在200-400字之间
3. 保持原有风格
4. 直接输出故事内容，不要有任何解释

故事背景：
${storyInput}

${type}版本：`;        // 调用SillyTavern的生成API
        const { generateQuietPrompt, callAPI } = await import("../../../../script.js");
        
        return new Promise((resolve, reject) => {
            const callback = (result) => {
                if (result) {
                    resolve({
                        id: index + 1,
                        content: result.trim(),
                        type: type
                    });
                } else {
                    reject(new Error('生成失败'));
                }
            };
            
            // 使用SillyTavern的API生成
            callAPI(
                {
                    prompt: prompt,
                    max_tokens: 500,
                    temperature: 0.8,
                    stop: []
                },
                callback,
                () => reject(new Error('API调用失败'))
            );
        });
    }

    // 显示结果
    function displayResults(stories) {
        const panel = document.getElementById('story-continuation-panel');
        const resultsContainer = panel.querySelector('#sc-results');
        
        resultsContainer.innerHTML = stories.map(story => `
            <div class="sc-story-card" data-id="${story.id}">
                <div class="sc-card-header">
                    <span class="sc-card-number">#${story.id} ${story.type}</span>
                    <div class="sc-card-actions">
                        <button class="sc-card-btn insert" data-content="${story.content.replace(/"/g, '&quot;')}">📥 插入</button>
                        <button class="sc-card-btn continue" data-content="${story.content.replace(/"/g, '&quot;')}" data-type="${story.type}">➡️ 继续</button>
                    </div>
                </div>
                <div class="sc-card-content">${story.content}</div>
            </div>
        `).join('');
        
        // 绑定卡片按钮事件
        resultsContainer.querySelectorAll('.sc-card-btn.insert').forEach(btn => {
            btn.addEventListener('click', () => {
                const content = btn.dataset.content;
                insertToChat(content);
            });
        });
        
        resultsContainer.querySelectorAll('.sc-card-btn.continue').forEach(btn => {
            btn.addEventListener('click', () => {
                const content = btn.dataset.content;
                const type = btn.dataset.type;
                continueStory(content, type);
            });
        });
    }

    // 插入到聊天
    function insertToChat(content) {
        const context = SillyTavern.getContext();
        
        // 添加到聊天
        context.chat.push({
            name: context.characters[context.characterId]?.name || '角色',
            mes: content,
            is_user: false
        });
        
        // 刷新UI
        if (typeof refreshChat !== 'undefined') {
            refreshChat();
        }
        
        // 显示确认
        alert('已插入到聊天中！');
    }

    // 继续续写
    async function continueStory(storyContent, type) {
        const panel = document.getElementById('story-continuation-panel');
        const input = panel.querySelector('#sc-story-input');
        
        // 将选中的故事设为新的输入
        input.value = storyContent;
        
        // 重新生成
        await generateStories();
    }

    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('故事续写扩展已加载');
})();
