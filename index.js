/**
 * 故事续写扩展 - 彩云小梦风格
 * 类似 www.xiaomengai.com 的故事续写功能
 * 
 * 功能流程：
 * 1. 用户输入故事背景/开头
 * 2. 选择续写方向（前传/后续/番外）
 * 3. 调用AI生成多个候选故事
 * 4. 用户选择插入聊天或继续扩展
 */

import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, callAPI, generateRaw } from "../../../../script.js";

const extensionName = "story_continuation_test";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// 默认设置
const defaultSettings = {
    generateCount: 3,
    continuationType: "后续",
    maxTokens: 500,
    temperature: 0.8,
    storyLength: "medium"
};

// 续写类型
const CONTINUATION_TYPES = [
    { value: "前传", label: "前传", desc: "发生在主故事之前的事件" },
    { value: "后续", label: "后续", desc: "主故事之后的发展" },
    { value: "番外", label: "番外", desc: "支线故事或配角视角" }
];

// 故事长度选项
const STORY_LENGTHS = [
    { value: "short", label: "短篇", tokens: 200 },
    { value: "medium", label: "中篇", tokens: 400 },
    { value: "long", label: "长篇", tokens: 800 }
];

/**
 * 中书省 - 规划模块
 * 负责构建Prompt和管理生成策略
 */
const ZhongshuPlanner = {
    // 构建续写Prompt
    buildPrompt(storyInput, type, length) {
        const lengthConfig = STORY_LENGTHS.find(l => l.value === length) || STORY_LENGTHS[1];
        
        return `你是一个专业的故事续写作家。请根据以下故事背景，创作一个【${type}】版本的故事。

【要求】
1. 故事类型：${type}
2. 字数：${lengthConfig.tokens}字左右
3. 风格：保持原故事的文风和基调
4. 逻辑：与原背景契合，有合理的剧情发展
5. 输出：只输出故事内容，不要有任何解释、括号备注或额外说明

【故事背景】
${storyInput}

【${type}版本】`;
    },

    // 构建系统提示词
    buildSystemPrompt() {
        return `你是一个专业的故事续写作家，擅长创作各种风格的故事。
- 根据用户提供的故事背景进行续写
- 保持原故事的设定、角色性格和文风
- 创作有趣、合理的剧情发展
- 直接输出故事内容，不需要解释`;
    }
};

/**
 * 门下省 - 审核模块
 * 负责验证输入和输出
 */
const MenxiaReviewer = {
    // 验证输入
    validateInput(storyInput) {
        if (!storyInput || storyInput.trim().length < 5) {
            throw new Error("故事背景至少需要5个字符");
        }
        if (storyInput.length > 5000) {
            throw new Error("故事背景不能超过5000字符");
        }
        return true;
    },

    // 验证输出
    validateOutput(output) {
        if (!output || output.trim().length < 10) {
            throw new Error("生成的故事内容过短");
        }
        return true;
    },

    // 清理输出（去除多余标记）
    cleanOutput(output) {
        return output
            .replace(/^【.*?】/gm, "")  // 去除【】标记
            .replace(/^续写故事：/gm, "")  // 去除"续写故事："
            .replace(/^以下是.*?版本：/gm, "")  // 去除"以下是...版本："
            .trim();
    }
};

/**
 * 工部 - 执行模块
 * 负责实际的API调用和UI渲染
 */
const GongbuExecutor = {
    // 调用AI生成故事
    async generateStory(prompt) {
        const settings = extension_settings[extensionName];
        
        return new Promise((resolve, reject) => {
            const payload = {
                prompt: prompt,
                max_tokens: parseInt(settings.maxTokens) || 500,
                temperature: parseFloat(settings.temperature) || 0.8,
                stop: []
            };
            
            console.log("[故事续写] 开始生成，参数:", payload);
            
            callAPI(
                payload,
                (result) => {
                    if (result) {
                        console.log("[故事续写] 生成成功");
                        resolve(result);
                    } else {
                        reject(new Error("生成返回为空"));
                    }
                },
                (error) => {
                    console.error("[故事续写] 生成失败:", error);
                    reject(error || new Error("API调用失败"));
                }
            );
        });
    },

    // 渲染设置面板HTML
    renderSettingsHTML() {
        return `
            <div class="story-continuation-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>📖 故事续写</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        ${this.renderInputSection()}
                        ${this.renderOptionsSection()}
                        ${this.renderGenerateButton()}
                        ${this.renderLoadingSection()}
                        ${this.renderResultsSection()}
                    </div>
                </div>
            </div>
        `;
    },

    renderInputSection() {
        return `
            <div class="sc-section">
                <label class="sc-label">故事背景 / 开头：</label>
                <textarea id="sc-story-input" class="sc-textarea" 
                    placeholder="输入故事背景或开头...
例如：在那个被遗忘的小镇上，有一座古老的钟楼..." 
                    rows="4"></textarea>
                <div class="sc-button-row">
                    <button id="sc-use-chat-btn" class="sc-btn secondary">
                        <span class="fa-solid fa-comments"></span> 使用当前聊天
                    </button>
                    <button id="sc-clear-btn" class="sc-btn secondary">
                        <span class="fa-solid fa-trash"></span> 清空
                    </button>
                </div>
            </div>
        `;
    },

    renderOptionsSection() {
        const typeOptions = CONTINUATION_TYPES.map(t => 
            `<label class="sc-radio-label">
                <input type="radio" name="continuation-type" value="${t.value}">
                <span class="sc-radio-text">${t.label}</span>
                <span class="sc-radio-desc">${t.desc}</span>
            </label>`
        ).join('');

        const lengthOptions = STORY_LENGTHS.map(l => 
            `<option value="${l.value}">${l.label}</option>`
        ).join('');

        return `
            <div class="sc-section sc-options-grid">
                <div class="sc-option-group">
                    <label class="sc-label">续写方向：</label>
                    <div class="sc-radio-group">
                        ${typeOptions}
                    </div>
                </div>
                <div class="sc-option-group">
                    <label class="sc-label">故事长度：</label>
                    <select id="sc-story-length" class="sc-select">
                        ${lengthOptions}
                    </select>
                </div>
                <div class="sc-option-group">
                    <label class="sc-label">生成数量：</label>
                    <select id="sc-generate-count" class="sc-select">
                        <option value="2">2 个</option>
                        <option value="3" selected>3 个</option>
                        <option value="4">4 个</option>
                        <option value="5">5 个</option>
                    </select>
                </div>
            </div>
        `;
    },

    renderGenerateButton() {
        return `
            <div class="sc-section">
                <button id="sc-generate-btn" class="sc-btn primary sc-generate-btn">
                    <span class="fa-solid fa-wand-magic-sparkles"></span> 
                    🚀 开始生成
                </button>
            </div>
        `;
    },

    renderLoadingSection() {
        return `
            <div id="sc-loading" class="sc-loading" style="display: none;">
                <div class="sc-spinner"></div>
                <span>AI 正在挥笔创作...</span>
                <div class="sc-progress">
                    <div id="sc-progress-bar" class="sc-progress-bar"></div>
                </div>
            </div>
        `;
    },

    renderResultsSection() {
        return `
            <div id="sc-results" class="sc-results"></div>
        `;
    },

    // 渲染单个故事卡片
    renderStoryCard(story, index) {
        return `
            <div class="sc-story-card" data-index="${index}">
                <div class="sc-card-header">
                    <span class="sc-card-badge">#${index + 1} ${story.type}</span>
                    <div class="sc-card-actions">
                        <button class="sc-card-btn insert" data-content="${this.escapeHtml(story.content)}" title="插入到聊天">
                            📥 插入
                        </button>
                        <button class="sc-card-btn copy" data-content="${this.escapeHtml(story.content)}" title="复制到剪贴板">
                            📋 复制
                        </button>
                        <button class="sc-card-btn continue" data-content="${this.escapeHtml(story.content)}" title="以此为基础继续创作">
                            ✍️ 续写
                        </button>
                    </div>
                </div>
                <div class="sc-card-content">${this.escapeHtml(story.content)}</div>
            </div>
        `;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/"/g, '&quot;').replace(/\n/g, '\\n');
    }
};

/**
 * 尚书省 - 调度模块
 * 负责协调各个模块的运作
 */
const ShangshuDispatcher = {
    async generate(storyInput, type, length, count) {
        const results = [];
        
        // 审核输入
        MenxiaReviewer.validateInput(storyInput);
        
        for (let i = 0; i < count; i++) {
            // 构建Prompt
            const prompt = ZhongshuPlanner.buildPrompt(storyInput, type, length);
            
            try {
                // 调用执行模块生成
                let rawOutput = await GongbuExecutor.generateStory(prompt);
                
                // 审核输出
                rawOutput = MenxiaReviewer.cleanOutput(rawOutput);
                MenxiaReviewer.validateOutput(rawOutput);
                
                results.push({
                    id: i + 1,
                    content: rawOutput,
                    type: type,
                    timestamp: Date.now()
                });
                
                // 更新进度条
                this.updateProgress((i + 1) / count * 100);
                
            } catch (error) {
                console.error(`第${i + 1}次生成失败:`, error);
                results.push({
                    id: i + 1,
                    content: `生成失败: ${error.message}`,
                    type: type,
                    error: true
                });
            }
        }
        
        return results;
    },

    updateProgress(percent) {
        const progressBar = document.getElementById('sc-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
    }
};

/**
 * 吏部 - 辅助功能
 * 负责聊天操作和设置管理
 */
const LibuHelper = {
    // 获取当前聊天内容
    getCurrentChat() {
        const context = getContext();
        const chat = context.chat;
        
        if (!chat || chat.length === 0) {
            return "";
        }
        
        // 获取最近10条消息
        const recentMessages = chat.slice(-10);
        
        return recentMessages.map(msg => {
            const name = msg.name || (msg.is_user ? "用户" : context.characters[context.characterId]?.name || "角色");
            return `${name}：${msg.mes}`;
        }).join('\n\n');
    },

    // 插入到聊天
    insertToChat(content) {
        const context = getContext();
        
        context.chat.push({
            name: context.characters[context.characterId]?.name || "角色",
            mes: content,
            is_user: false,
            updatedAt: Date.now()
        });
        
        // 刷新UI
        if (typeof renderChat !== "undefined") {
            renderChat();
        }
        
        toastr.success("📥 已插入到聊天中！");
    },

    // 复制到剪贴板
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            toastr.info("📋 已复制到剪贴板！");
        }).catch(err => {
            toastr.error("复制失败：" + err.message);
        });
    }
};

/**
 * 主初始化模块
 */
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    
    // 恢复UI状态
    const settings = extension_settings[extensionName];
    $("#sc-generate-count").val(settings.generateCount || 3);
    $(`input[name="continuation-type"][value="${settings.continuationType || '后续'}"]`).prop("checked", true);
    $("#sc-story-length").val(settings.storyLength || "medium");
}

function saveSettings() {
    const settings = extension_settings[extensionName];
    settings.generateCount = parseInt($("#sc-generate-count").val());
    settings.continuationType = $('input[name="continuation-type"]:checked').val();
    settings.storyLength = $("#sc-story-length").val();
    
    // 根据长度自动调整maxTokens
    const lengthConfig = STORY_LENGTHS.find(l => l.value === settings.storyLength) || STORY_LENGTHS[1];
    settings.maxTokens = lengthConfig.tokens;
    
    saveSettingsDebounced();
    console.log("[故事续写] 设置已保存:", settings);
}

function bindEvents() {
    // 生成按钮
    $("#sc-generate-btn").on("click", async function() {
        const storyInput = $("#sc-story-input").val().trim();
        const type = $('input[name="continuation-type"]:checked').val();
        const length = $("#sc-story-length").val();
        const count = parseInt($("#sc-generate-count").val()) || 3;
        
        if (!storyInput) {
            toastr.warning("请输入故事背景或开头！");
            return;
        }
        
        // 显示加载状态
        $("#sc-loading").show();
        $("#sc-results").html("");
        $("#sc-generate-btn").prop("disabled", true);
        
        try {
            const stories = await ShangshuDispatcher.generate(storyInput, type, length, count);
            displayResults(stories);
        } catch (error) {
            console.error("生成失败:", error);
            toastr.error("生成失败: " + error.message);
        } finally {
            $("#sc-loading").hide();
            $("#sc-generate-btn").prop("disabled", false);
            $("#sc-progress-bar").css("width", "0%");
        }
    });
    
    // 使用当前聊天
    $("#sc-use-chat-btn").on("click", function() {
        const chatContent = LibuHelper.getCurrentChat();
        if (chatContent) {
            $("#sc-story-input").val(chatContent);
            toastr.info("已加载当前聊天内容");
        } else {
            toastr.warning("当前没有聊天记录");
        }
    });
    
    // 清空按钮
    $("#sc-clear-btn").on("click", function() {
        $("#sc-story-input").val("");
    });
    
    // 设置变更保存
    $("#sc-generate-count, #sc-story-length").on("change", saveSettings);
    $('input[name="continuation-type"]').on("change", saveSettings);
    
    // 动态绑定卡片按钮（使用事件委托）
    $(document).on("click", ".sc-card-btn.insert", function() {
        const content = $(this).data("content").replace(/\\n/g, '\n');
        LibuHelper.insertToChat(content);
    });
    
    $(document).on("click", ".sc-card-btn.copy", function() {
        const content = $(this).data("content").replace(/\\n/g, '\n');
        LibuHelper.copyToClipboard(content);
    });
    
    $(document).on("click", ".sc-card-btn.continue", function() {
        const content = $(this).data("content").replace(/\\n/g, '\n');
        $("#sc-story-input").val(content);
        // 触发滚动到输入框
        $("#sc-story-input").focus();
        toastr.info("已填入内容，继续编辑后点击生成");
    });
}

function displayResults(stories) {
    const resultsContainer = $("#sc-results");
    
    if (stories.length === 0) {
        resultsContainer.html('<div class="sc-empty">没有生成任何故事</div>');
        return;
    }
    
    let html = '';
    stories.forEach((story, index) => {
        if (story.error) {
            html += `
                <div class="sc-story-card sc-error">
                    <div class="sc-card-content">${story.content}</div>
                </div>
            `;
        } else {
            html += GongbuExecutor.renderStoryCard(story, index);
        }
    });
    
    resultsContainer.html(html);
}

// 扩展加载入口
jQuery(async () => {
    console.log("[故事续写] 扩展开始加载...");
    
    // 渲染UI
    const html = GongbuExecutor.renderSettingsHTML();
    $("#extensions_settings").append(html);
    
    // 绑定事件
    bindEvents();
    
    // 加载设置
    await loadSettings();
    
    console.log("[故事续写] 扩展加载完成！");
});

console.log("[故事续写] 脚本已解析");
