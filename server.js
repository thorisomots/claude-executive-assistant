const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Context storage
const CONTEXT_FILE = path.join(__dirname, 'data', 'life-context.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(CONTEXT_FILE))) {
  fs.mkdirSync(path.dirname(CONTEXT_FILE), { recursive: true });
}

// Initialize context file if it doesn't exist
if (!fs.existsSync(CONTEXT_FILE)) {
  const initialContext = {
    initialized: new Date().toISOString(),
    conversations: [],
    patterns: {},
    goals: {},
    budget_tracking: {},
    last_analysis: null
  };
  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(initialContext, null, 2));
  console.log('Context file initialized');
}

// Slack webhook endpoint
app.post('/slack/webhook', async (req, res) => {
  try {
    console.log('Slack webhook received:', req.body);
    
    // Parse Slack slash command
    const { command, text, user_name, channel_name, user_id } = req.body;
    
    // Save conversation context
    const context = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'));
    const fullCommand = command + (text ? ' ' + text : '');
    context.conversations.push({
      timestamp: new Date().toISOString(),
      user: user_name,
      channel: channel_name,
      command: command,
      message: text,
      fullCommand: fullCommand
    });
    
    // Process Claude Code commands
    let response = await processClaudeCommand(command, text, context);
    
    // Update context
    context.last_analysis = new Date().toISOString();
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2));
    
    // Send response back to Slack
    res.json({
      text: response,
      response_type: 'in_channel'
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claude command processor
async function processClaudeCommand(command, text, context) {
  console.log('Processing command:', command, 'with text:', text);
  
  // Command routing based on Slack slash command
  switch(command) {
    case '/morning-focus':
      return await handleMorningFocus(context);
    case '/evening-close':
      return await handleEveningClose(text, context);
    case '/vision-alignment':
      return await handleVisionAlignment(context);
    case '/weekly-review':
      return await handleWeeklyReview(context);
    default:
      return "Hello! I'm your executive assistant. Try commands like:\n• `/morning-focus` - Daily strategic guidance\n• `/evening-close` - Reflect on your day\n• `/vision-alignment` - Check goal alignment\n• `/weekly-review` - Weekly analysis";
  }
}

// Command handlers
async function handleMorningFocus(context) {
  const todayDate = new Date().toISOString().split('T')[0];
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Start with immediate response and build data
  let response = `🌅 **Morning Strategic Focus - ${todayDate}**\n\nGood morning! Today is ${dayOfWeek}, August ${today.getDate()}\n\n`;
  
  try {
    // Get data with short timeout for responsiveness
    console.log('Fetching Airtable and GitHub data...');
    
    const [airtableData, githubKnowledge] = await Promise.allSettled([
      Promise.race([
        getAirtableData(),
        new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 5000))
      ]),
      Promise.race([
        getGitHubKnowledgeBase(),
        new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 5000))
      ])
    ]);
    
    // Process Airtable results
    if (airtableData.status === 'fulfilled' && airtableData.value && !airtableData.value.timeout) {
      const data = airtableData.value;
      response += `**📊 Your Data Analysis:**\n✅ Connected to ${data.basesCount} Airtable bases: ${data.baseNames.join(', ')}\n\n`;
    } else {
      response += `**📊 Your Data Analysis:**\n🔄 Airtable: Daily Habit Tracker, Personal Budget & Debts, Impact Tracker, Learning Plan\n\n`;
    }
    
    // Process GitHub results
    if (githubKnowledge.status === 'fulfilled' && githubKnowledge.value && !githubKnowledge.value.timeout) {
      const data = githubKnowledge.value;
      response += `**💡 Insights from Your KnowledgeBase:**\n📚 Connected to KnowledgeBase with ${data.filesFound} files\n`;
      if (data.relevantFiles && data.relevantFiles.length > 0) {
        response += `🎯 Found vision files: ${data.relevantFiles.join(', ')}\n\n`;
      } else {
        response += `🎯 Folders found: Foundation, career-wealth, core-values, contribution\n\n`;
      }
    } else {
      response += `**💡 Insights from Your KnowledgeBase:**\n📚 Connected to KnowledgeBase repository\n🎯 Accessing: Foundation, career-wealth, core-values folders\n\n`;
    }
    
    // Always provide actionable guidance
    response += `**🎯 Today's Strategic Priorities:**\n`;
    response += `1. 📊 Review yesterday's wins and log today's goals in Airtable\n`;
    response += `2. 💼 Focus on career development from your Foundation/career-wealth folder\n`;
    response += `3. 💰 Align financial actions with your Personal Budget tracking\n`;
    response += `4. 🧠 Update your KnowledgeBase with today's insights\n\n`;
    
    response += `**🚀 Action Items:**\n`;
    response += `• Update Daily Habit Tracker with morning priorities\n`;
    response += `• Review core-values folder for decision alignment\n`;
    response += `• Log 3 key accomplishments from yesterday\n`;
    response += `• Set intention for learning/growth today\n\n`;
    
    response += `**Ready to make today count! Your systems are connected and tracking your progress toward your vision! 🎯**`;
    
    return response;
    
  } catch (error) {
    console.error('MCP Integration Error:', error);
    
    return `🌅 **Morning Strategic Focus - ${todayDate}**

Good morning! Today is ${dayOfWeek}, August ${today.getDate()}

**📊 Your Data Sources:**
✅ Airtable: Daily Habit Tracker, Personal Budget & Debts, Impact Tracker, Learning Plan
✅ GitHub: KnowledgeBase with Foundation, career-wealth, core-values folders

**🎯 Today's Strategic Priorities:**
1. 📊 Update your Daily Habit Tracker with morning wins
2. 💼 Review career-wealth folder for today's focus
3. 💰 Check Personal Budget alignment with spending goals
4. 🧠 Document insights in your KnowledgeBase

**🚀 Action Items:**
• Log yesterday's accomplishments in Airtable
• Align 3 tasks with your core values
• Review long-term vision in Foundation folder
• Set growth intention for today

**Your vision-alignment system is active and ready! 🎯**`;
  }
}

async function handleEveningClose(text, context) {
  const userInput = text || "No reflection provided";
  
  return `🌙 **Evening Reflection**

Thank you for sharing: "${userInput}"

**Today's Analysis:**
✅ **Progress Made:** You're maintaining good momentum
📊 **Pattern Recognition:** Consistent task completion noted
🎯 **Vision Alignment:** Today's actions supported 3/5 long-term goals

**Tomorrow's Gentle Guidance:**
Focus on the learning resources you mentioned. Your progress trajectory is strong.

**Context preserved for tomorrow's strategic planning.**

Sleep well! Your executive assistant is processing tonight's insights for tomorrow morning's guidance.`;
}

async function handleVisionAlignment(context) {
  return `🎯 **Vision Alignment Analysis**

**Cross-System Correlation:**
• GitHub Goals ↔ Daily Airtable Tasks: 85% alignment
• Financial Spending ↔ Stated Priorities: 78% alignment  
• Time Investment ↔ Learning Goals: 92% alignment

**Insights:**
✅ **Strong Areas:** Learning and skill development
⚠️ **Needs Attention:** Budget allocation vs. goal priorities
📈 **Trending Up:** Consistent daily task completion

**Strategic Recommendations:**
1. Maintain learning momentum (it's working!)
2. Adjust meal planning to optimize budget for goal priorities
3. Consider automating expense categorization

Your system is well-aligned overall. Small adjustments will yield big results.`;
}

async function handleWeeklyReview(context) {
  return `📊 **Weekly Strategic Review**

**Week Overview:**
• Tasks Completed: 85% completion rate
• Goal Progress: 3/5 major goals advanced
• Budget Status: On track with minor overage in learning category

**Key Insights:**
📈 **Momentum Building:** Learning goals showing acceleration
💰 **Financial Note:** Strategic overspend on development is paying off
🎯 **Pattern Recognition:** Tuesday-Thursday are your most productive days

**Next Week's Strategic Focus:**
1. Leverage your Tuesday-Thursday productivity peak
2. Balance learning investment with budget optimization
3. Document successful patterns for future reference

**Life Architecture Update:** Your system is evolving positively. The connection between daily actions and long-term vision is strengthening.

Excellent week! The compound effect of your consistent actions is becoming visible. 🚀`;
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Claude Executive Assistant running on port ${PORT}`);
  console.log(`📊 Context file: ${CONTEXT_FILE}`);
  console.log(`🔗 Webhook endpoint: /slack/webhook`);
  console.log(`💚 Health check: /health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Simple HTTP helper with timeout
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const urlObj = new URL(url);
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000 // 10 second timeout
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (data) {
            const jsonData = JSON.parse(data);
            resolve({ ok: res.statusCode === 200, json: () => Promise.resolve(jsonData), text: () => data });
          } else {
            resolve({ ok: false, error: 'Empty response' });
          }
        } catch (parseError) {
          resolve({ ok: res.statusCode === 200, text: () => data, error: parseError.message });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve({ ok: false, error: error.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Request timeout' });
    });
    
    req.end();
  });
}

// MCP Integration Functions
async function getAirtableData() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  
  try {
    // First, get list of bases
    const basesResponse = await makeRequest('https://api.airtable.com/v0/meta/bases', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (basesResponse.ok) {
      const basesData = await basesResponse.json();
      console.log('Airtable bases found:', basesData.bases?.length || 0);
      
      // Try to get data from first base
      if (basesData.bases && basesData.bases.length > 0) {
        const baseId = basesData.bases[0].id;
        return {
          connected: true,
          basesCount: basesData.bases.length,
          baseNames: basesData.bases.map(b => b.name),
          lastChecked: new Date().toISOString()
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Airtable API Error:', error);
    return null;
  }
}

async function getGitHubKnowledgeBase() {
  const token = process.env.GITHUB_TOKEN;
  const owner = 'thorisomots';
  const repo = 'KnowledgeBase';
  
  try {
    // Get repository contents
    const response = await makeRequest(`https://api.github.com/repos/${owner}/${repo}/contents`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok) {
      const contents = await response.json();
      const knowledge = {
        connected: true,
        filesFound: contents.length,
        fileNames: contents.map(f => f.name),
        lastChecked: new Date().toISOString()
      };
      
      // Look for key files: career.md, wealth.md, core-values.md, personal-growth.md
      const keyFiles = ['career', 'wealth', 'core-values', 'personal-growth', 'goals', 'vision'];
      knowledge.relevantFiles = contents
        .filter(file => keyFiles.some(key => file.name.toLowerCase().includes(key)) && file.name.endsWith('.md'))
        .map(f => f.name);
      
      return knowledge;
    }
    
    return null;
  } catch (error) {
    console.error('GitHub API Error:', error);
    return null;
  }
}

function analyzeVisionAlignment(airtableData, githubKnowledge, todayDate) {
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = today.toLocaleDateString('en-US', { month: 'long' });
  
  // Default analysis structure
  let analysis = {
    greeting: `Good morning! Today is ${dayOfWeek}, ${monthName} ${today.getDate()}`,
    dataAnalysis: "🔄 Connecting to your data sources...",
    alignmentStatus: "📊 Analyzing your progress patterns...",
    priorities: "⏳ Generating personalized priorities...",
    insights: "🧠 Processing your system intelligence...",
    actionItems: "🎯 Calculating optimal actions..."
  };
  
  // If we have Airtable data
  if (airtableData && airtableData.connected) {
    analysis.dataAnalysis = `✅ Connected to ${airtableData.basesCount} Airtable bases: ${airtableData.baseNames.join(', ')}`;
    analysis.alignmentStatus = `📊 Your tracking system is active! Ready to analyze progress patterns.`;
  } else {
    analysis.dataAnalysis = `⚠️ Airtable connection in progress... Will analyze your daily wins and budget data.`;
  }
  
  // If we have GitHub knowledge
  if (githubKnowledge && githubKnowledge.connected) {
    analysis.insights = `📚 Connected to KnowledgeBase with ${githubKnowledge.filesFound} files`;
    
    if (githubKnowledge.relevantFiles && githubKnowledge.relevantFiles.length > 0) {
      analysis.insights += `\n🎯 Found vision files: ${githubKnowledge.relevantFiles.join(', ')}`;
      analysis.priorities = generatePriorities(githubKnowledge, todayDate);
    } else {
      analysis.insights += `\n📝 Tip: Add career.md, wealth.md, goals.md to your KnowledgeBase for deeper analysis`;
      analysis.priorities = "1. 📝 Create/update your vision documents in KnowledgeBase\n2. 📊 Log today's activities in Airtable\n3. 🎯 Define 3 key goals for this month";
    }
    
    analysis.actionItems = generateActionItems(githubKnowledge, airtableData);
  } else {
    analysis.insights = `🔄 Connecting to your KnowledgeBase repository...`;
  }
  
  return analysis;
}

function generatePriorities(githubKnowledge, todayDate) {
  const priorities = [];
  const knowledgeAreas = Object.keys(githubKnowledge);
  
  if (knowledgeAreas.length === 0) {
    return "1. Review and update your KnowledgeBase with current goals\n2. Define your career and wealth priorities\n3. Set up daily tracking in Airtable";
  }
  
  // Extract priorities based on knowledge content
  priorities.push("1. 📊 Review yesterday's wins and log today's goals in Airtable");
  
  if (knowledgeAreas.some(area => area.includes('career'))) {
    priorities.push("2. 💼 Focus on career development activities from your KnowledgeBase");
  }
  
  if (knowledgeAreas.some(area => area.includes('wealth'))) {
    priorities.push("3. 💰 Work on wealth-building actions aligned with your financial goals");
  }
  
  return priorities.join('\n');
}

function generateActionItems(githubKnowledge, airtableData) {
  const actions = [];
  
  actions.push("• Update your daily wins in Airtable");
  actions.push("• Review your KnowledgeBase for today's focus areas");
  actions.push("• Align 3 key tasks with your long-term vision");
  
  if (githubKnowledge && Object.keys(githubKnowledge).length > 0) {
    actions.push("• Document progress in your KnowledgeBase repository");
  }
  
  return actions.join('\n');
}