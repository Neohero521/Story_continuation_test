/**
 * 故事续写扩展 - 类似彩云小梦
 * 调用所有Agent（三省六部）进行协作
 */

import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, callAPI } from "../../../../script.js";

const extensionName = "story_continuation_test";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// 默认设置
const defaultSettings = {
    generateCount: 3,
    continuationType: "后续",
    maxTokens: 500,
    temperature: 0.8,
    selectedAgent: "main"
};

// Agent配置
const AGENTS = {
    "main": { name: "🐋 鲸鱼娘", role: "中枢" },
    "taizi": { name: "👑 太子", role: "分拣" },
    "zhongshu": { name: "📜 中书省", role: "规划" },
    "menxia": { name: "🔍 门下省", role: "审核" },
    "shangshu": { name: "📨 尚书省", role: "派发" },
    "libu": { name: "👤 吏部", role: "人事" },
    "hubu": { name: "💰 户部", role: "财务" },
    "bingbu": { name: "⚔️ 兵部", role: "军事" },
    "gongbu": { name: "🔧 工部", role: "技术" },
    "xingbu": { name: "⚖️ 刑部", role: "法律" },
    "zaoqiao": { name: "🌅 早朝官", role: "早间" }
};

// 加载设置
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    
    // 更新UI
    $("#sc-generate-count").val(extension_settings[extensionName].generateCount);
    $(`input[name="continuation-type"][value="${extension_settings[extensionName].continuationType}"]`).prop("checked", true);
    $("#sc-selected-agent").val(extension_settings[extensionName].selectedAgent);
}

// 保存设置
function saveSettings() {
    extension_settings[extensionName].generateCount = parseInt($("#sc-generate-count").val());
    extension_settings[extensionName].continuationType = $('input[name="continuation-type"]:checked').val();
    extension_settings[extensionName].selectedAgent = $("#sc-selected-agent").val();
    saveSettingsDebounced();
}

// 使用当前聊天内容
function useCurrentChat() {
    const context = getContext();
    const chat = context.chat;
    
    if (chat && chat.length > 0) {
        let content = "";
        const recentMessages = chat.slice(-8).forEach(msg => {
            const name = msg.name || (msg.is_user ? "用户" : context.characters[context.characterId]?.name || "角色");
            content += `${name}: ${msg.mes}\n\n`;
        });
        
        $("#sc-story-input").val(content);
    }
}

// 通过OpenClaw API调用Agent
async function callAgent(agentId, prompt) {
    return new Promise((resolve, reject) => {
        // 使用SillyTavern的API调用
        // 这里模拟调用 - 实际需要通过SillyTavern连接到OpenClaw
        const context = getContext();
        
        // 构建prompt
        const fullPrompt = `你现在是${AGENTS[agentId].name}（${AGENTS[agentId].role}），请根据以下故事背景续写一个${extension_settings[extensionName].continuationType}版本：

故事背景：
${prompt}

要求：
1. 故事要有逻辑性，与原背景契合
2. 字数在150-300字之间
3. 保持原有风格
4. 直接输出故事内容，不要有任何解释

续写故事：`;

// 调用SillyTavern的生成API
        callAPI(
            {
                prompt: fullPrompt,
                max_tokens: parseInt(extension_settings[extensionName].maxTokens) || 500,
                temperature: parseFloat(extension_settings[extensionName].temperature) || 0.8,
                stop: []
            },
            (result) => {
                if (result) {
                    resolve(result.trim());
                } else {
                    reject(new Error("生成失败"));
                }
            },
            () => reject(new Error("API调用失败"))
        );
    });
}

// 生成故事
async function generateStories() {
    const storyInput = $("#sc-story-input").val().trim();
    const resultsContainer = $("#sc-results");
    const generateBtn = $("#sc-generate-btn");
    
    if (!storyInput) {
        toastr.warning("请输入故事背景或开头！");
        return;
    }
    
    // 显示加载状态
    $("#sc-loading").show();
    resultsContainer.html("");
    generateBtn.prop("disabled", true);
    
    try {
        const count = extension_settings[extensionName].generateCount || 3;
        const stories = [];
        
        // 选择使用哪个agent
        const selectedAgent = extension_settings[extensionName].selectedAgent || "main";
        
        // 批量生成多个版本
        for (let i = 0; i < count; i++) {
            const story = await callAgent(selectedAgent, storyInput);
            stories.push({
                id: i + 1,
                content: story,
                type: extension_settings[extensionName].continuationType,
                agent: selectedAgent
            });
        }
        
        // 显示结果
        displayResults(stories);
        
    } catch (error) {
        console.error("生成失败:", error);
        toastr.error("生成失败: " + error.message);
    } finally {
        $("#sc-loading").hide();
        generateBtn.prop("disabled", false);
    }
}

// 显示结果
function displayResults(stories) {
    const resultsContainer = $("#sc-results");
    
    let html = "";
    stories.forEach(story => {
        html += `
        <div class="sc-story-card" data-id="${story.id}">
            <div class="sc-card-header">
                <span class="sc-card-number">#${story.id} ${story.type} - ${AGENTS[story.agent]?.name || "未知"}</span>
                <div class="sc-card-actions">
                    <button class="sc-card-btn insert" data-content="${story.content.replace(/"/g, '&quot;').replace(/\n/g, '\\n')}">📥 插入</button>
                    <button class="sc-card-btn continue" data-content="${story.content.replace(/"/g, '&quot;').replace(/\n/g, '\\n')}" data-type="${story.type}">➡️ 继续</button>
                </div>
            </div>
            <div class="sc-card-content">${story.content}</div>
        </div>`;
    });
    
    resultsContainer.html(html);
    
    // 绑定事件
    $(".sc-card-btn.insert").on("click", function() {
        const content = $(this).data("content");
        insertToChat(content);
    });
    
    $(".sc-card-btn.continue").on("click", function() {
        const content = $(this).data("content");
        $("#sc-story-input").val(content);
        generateStories();
    });
}

// 插入到聊天
function insertToChat(content) {
    const context = getContext();
    
    // 添加到聊天
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
    
    toastr.success("已插入到聊天中！");
}

// 扩展加载时初始化
jQuery(async () => {
    // 加载HTML模板
    const settingsHtml = await $.get(`${extensionFolderPath}/story-panel.html`);
    
    // 添加到设置面板
    $("#extensions_settings").append(settingsHtml);
    
    // 绑定事件
    $("#sc-generate-btn").on("click", generateStories);
    $("#sc-use-chat-btn").on("click", useCurrentChat);
    $("#sc-generate-count").on("change", saveSettings);
    $('input[name="continuation-type"]').on("change", saveSettings);
    $("#sc-selected-agent").on("change", saveSettings);
    
    // 加载设置
    await loadSettings();
    
    console.log("故事续写扩展已加载");
});
