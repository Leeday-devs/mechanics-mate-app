# My Mechanic

An AI-powered automotive assistant that helps users with car repair, maintenance questions, and troubleshooting. Built with Claude AI and enhanced with real-time forum search for verified, up-to-date automotive advice.

## Features

### Core Features
- **Mobile-First Design**: Optimized for smartphones with touch-friendly controls and responsive layout
- **Vehicle-Specific Assistance**: Select your vehicle's year, make, model, engine type, and size for tailored advice
- **Real-Time Forum Search**: Searches popular automotive forums (Reddit r/MechanicAdvice, r/Cartalk, BobIsTheOilGuy, RepairPal) for real-world experiences
- **AI Answer Verification**: Cross-references forum discussions, service manuals, TSBs, and recalls before responding
- **Expert Automotive Advice**: Powered by Claude Sonnet 4.5 with comprehensive automotive knowledge
- **Step-by-Step Guides**: Detailed troubleshooting and repair instructions specific to your vehicle
- **Racing-Themed Dark UI**: Professional car-branded interface with dark mode design
- **Safety-First Approach**: Always includes safety warnings and professional service recommendations when appropriate

### Latest Features (v2.0)
- **Full PWA Support**: Install as a progressive web app with offline functionality via service worker
- **Offline Capability**: Works offline for previously loaded content, with graceful error messages
- **Environment-Aware API**: Automatically detects localhost vs production for seamless deployment
- **Professional Icons**: Custom SVG icons throughout the UI (wrench & gear theme)
- **Vehicle Preset Saving**: Automatically saves and restores your vehicle selection
- **Typing Indicator**: Beautiful animated dots while AI is thinking
- **Enhanced Error Recovery**: Detailed error messages with retry suggestions and troubleshooting tips
- **Conversation Export**: Export chat history as text (.txt) or JSON (.json) files
- **Auto-Save**: Conversations are automatically saved to browser storage (24-hour retention)
- **Conversation Recovery**: Restore previous conversations when reopening the app
- **Rate Limiting**: Built-in API protection prevents abuse (10 requests/minute)
- **Enhanced Markdown**: Full support for headers, lists, code blocks, links, and formatting
- **Random Car Animation**: Fun loading indicator with different vehicle types
- **Extended Vehicle Database**: Complete model listings for 31 car manufacturers (UK/European focused)
- **Security Documentation**: Comprehensive guides for API key security and rotation

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- **Required**: Anthropic API key ([Get one here](https://console.anthropic.com/settings/keys))
- **Optional but Recommended**: Google Custom Search API credentials for real-time forum search
  - Google Search API Key ([Get one here](https://console.cloud.google.com/apis/credentials))
  - Custom Search Engine ID ([Create one here](https://programmablesearchengine.google.com/))

## Installation

1. Clone or download this project

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Add your API keys to the `.env` file:
```
# Required - Get from https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=your_api_key_here

# Optional - For real-time forum search
GOOGLE_SEARCH_API_KEY=your_google_search_api_key_here
SEARCH_ENGINE_ID=your_search_engine_id_here

# Optional - Server port (defaults to 3000)
PORT=3000
```

**Note**: The app will work without Google Search API credentials, but won't be able to search forums for real-time information.

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. (Optional) Select your vehicle details using the dropdown menus:
   - Year (2000-2025)
   - Make (Acura, Audi, BMW, Chevrolet, Ford, Honda, Toyota, etc.)
   - Model (dynamically populated based on make)
   - Engine Type (Gas/Petrol, Diesel, Hybrid, Plug-in Hybrid, Electric)
   - Engine Size (1.0L - 6.2L)

4. Start chatting with My Mechanic! Ask questions like:
   - "My check engine light is on, what should I do?"
   - "How often should I change my oil?"
   - "My car won't start, help me troubleshoot"
   - "What's the recommended tire pressure for my car?"

The AI will use your vehicle information to provide specific, verified answers based on your exact make and model.

## Project Structure

```
my-mechanic/
├── index.html          # Main HTML file
├── style.css           # Styling (mobile-first responsive)
├── script.js           # Frontend JavaScript with PWA support
├── server.js           # Backend API server (Express + Claude)
├── service-worker.js   # Service worker for PWA offline support
├── manifest.json       # PWA manifest
├── icon-192.svg        # PWA icon (192x192)
├── icon-512.svg        # PWA icon (512x512)
├── favicon.svg         # Browser favicon
├── package.json        # Dependencies
├── .env.example        # Environment variables template
├── .env                # Your API keys (not in git)
├── README.md           # This file
├── DEPLOYMENT.md       # Deployment guide for various platforms
├── SECURITY.md         # Security guidelines and API key rotation
└── .gitignore          # Git ignore file
```

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **AI**: Anthropic Claude API (claude-3-5-sonnet-20250219)
- **Search**: Google Custom Search API (for real-time forum search)
- **HTTP Client**: Axios (for forum API requests)
- **Other**: CORS, dotenv

## How It Works

### Vehicle-Specific Context
When you select your vehicle details, the system automatically includes this information with every question you ask. This allows the AI to provide answers specific to your exact vehicle configuration, including:
- Vehicle-specific torque specifications
- Correct fluid types and capacities
- Common issues for your make/model/year
- Applicable recalls and TSBs

### Real-Time Forum Search
Before responding to your question, My Mechanic:
1. Extracts your vehicle information and question
2. Searches automotive forums (Reddit r/MechanicAdvice, r/Cartalk, BobIsTheOilGuy, RepairPal)
3. Retrieves the top 5 most relevant discussions
4. Passes forum results to Claude AI for analysis

### Answer Verification Process
The AI follows a multi-step verification process:
1. **Analyze** your question and vehicle context
2. **Review** real-world forum discussions and user experiences
3. **Search** internal knowledge base for vehicle-specific information
4. **Cross-reference** common issues, recalls, and TSBs
5. **Verify** answers against multiple sources
6. **Cite** sources when referencing forum discussions
7. **Provide** verified, accurate answers with safety warnings

## Setting Up Google Custom Search (Optional)

To enable real-time forum search:

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Custom Search API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Custom Search API"
   - Click "Enable"

3. **Get API Key**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy your API key to `.env` as `GOOGLE_SEARCH_API_KEY`

4. **Create Custom Search Engine**:
   - Go to [Programmable Search Engine](https://programmablesearchengine.google.com/)
   - Click "Add" to create a new search engine
   - Add these sites to search:
     - reddit.com/r/MechanicAdvice
     - reddit.com/r/Cartalk
     - bobistheoilguy.com
     - repairpal.com
   - Enable "Search the entire web"
   - Copy the "Search engine ID" to `.env` as `SEARCH_ENGINE_ID`

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for:
- Vercel
- Netlify
- Railway
- Heroku
- Self-hosted VPS

## Security

See [SECURITY.md](SECURITY.md) for:
- API key rotation instructions
- Security best practices
- What to do if your key is compromised

## Future Enhancements

- [ ] PNG icon generation script for better PWA compatibility
- [ ] Diagnostic wizard for systematic troubleshooting
- [ ] User accounts and cloud sync
- [ ] PDF export of repair guides
- [ ] Integration with parts pricing APIs
- [ ] Video tutorial recommendations
- [ ] Maintenance schedule reminders and notifications
- [ ] Voice input for hands-free use
- [ ] Multi-language support

## License

MIT

## Support

For issues or questions, please create an issue in the repository.
