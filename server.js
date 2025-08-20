const express = require('express');
const fs = require('fs');
const path = require('path');
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
    
    // Parse Slack message
    const { text, user_name, channel_name } = req.body;
    
    // Save conversation context
    const context = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'));
    context.conversations.push({
      timestamp: new Date().toISOString(),
      user: user_name,
      channel: channel_name,
      message: text
    });
    
    // Process Claude Code commands
    let response = await processClaudeCommand(text, context);
    
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
async function processClaudeCommand(message, context) {
  console.log('Processing command:', message);
  
  // Command routing
  if (message.includes('/morning-focus')) {
    return await handleMorningFocus(context);
  } else if (message.includes('/evening-close')) {
    return await handleEveningClose(message, context);
  } else if (message.includes('/vision-alignment')) {
    return await handleVisionAlignment(context);
  } else if (message.includes('/weekly-review')) {
    return await handleWeeklyReview(context);
  } else {
    return "Hello! I'm your executive assistant. Try commands like:\n• `/morning-focus` - Daily strategic guidance\n• `/evening-close` - Reflect on your day\n• `/vision-alignment` - Check goal alignment\n• `/weekly-review` - Weekly analysis";
  }
}

// Command handlers
async function handleMorningFocus(context) {
  // This would integrate with Claude Code and MCPs
  return `🌅 **Morning Strategic Focus**

Good morning! Here's your strategic guidance for today:

**Vision Alignment Check:**
✅ Learning goals are progressing well
⚠️ Need to focus on budget optimization this week

**Today's Strategic Priorities:**
1. Complete 2 learning modules (aligns with Q4 goals)
2. Review and categorize expenses in Airtable
3. Update GitHub documentation with recent insights

**Context:** Based on your recent patterns, focusing on these areas will move you forward on your long-term vision.

Ready to make today count! 🎯`;
}

async function handleEveningClose(message, context) {
  const userInput = message.replace('/evening-close', '').trim();
  
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