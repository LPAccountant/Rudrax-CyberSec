import { useState, useEffect, useRef } from 'react';
import { 
  Terminal, Shield, Code, Brain, Globe, Server, 
  FileCode, Settings, Play, Pause, 
  RotateCcw, CheckCircle, AlertTriangle, Cpu, 
  Lock, Search, Zap, Activity, Menu, X, Send,
  ChevronRight, FileText, Trash2,
  Languages, Moon, Sun, Database, Network, Bug,
  Scan, Target, Radio, Wifi, Fingerprint, Eye,
  Plus, Copy, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import './App.css';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agent?: string;
}

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  agent: string;
  description: string;
}

interface Agent {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  active: boolean;
}

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  size?: string;
  modified: Date;
}

interface TerminalCommand {
  id: string;
  command: string;
  output: string;
  status: 'running' | 'completed' | 'error';
  timestamp: Date;
}

interface SecurityTool {
  id: string;
  name: string;
  category: string;
  description: string;
  command: string;
  icon: React.ReactNode;
}

// Agent Definitions
const AGENTS: Agent[] = [
  {
    id: 'planner',
    name: 'Task Planner',
    icon: <Brain className="w-5 h-5" />,
    description: 'Analyzes tasks and creates execution plans',
    color: 'bg-purple-500',
    active: true
  },
  {
    id: 'coder',
    name: 'Code Agent',
    icon: <Code className="w-5 h-5" />,
    description: 'Generates and debugs code',
    color: 'bg-blue-500',
    active: true
  },
  {
    id: 'security',
    name: 'Security Agent',
    icon: <Shield className="w-5 h-5" />,
    description: 'Performs security analysis and red-team ops',
    color: 'bg-red-500',
    active: true
  },
  {
    id: 'tester',
    name: 'Test Agent',
    icon: <Bug className="w-5 h-5" />,
    description: 'Tests and validates outputs',
    color: 'bg-green-500',
    active: true
  },
  {
    id: 'infra',
    name: 'Infra Agent',
    icon: <Server className="w-5 h-5" />,
    description: 'Manages infrastructure and deployments',
    color: 'bg-orange-500',
    active: true
  },
  {
    id: 'web',
    name: 'Web Agent',
    icon: <Globe className="w-5 h-5" />,
    description: 'Handles web and API interactions',
    color: 'bg-cyan-500',
    active: true
  }
];

// Security Tools
const SECURITY_TOOLS: SecurityTool[] = [
  {
    id: 'nmap',
    name: 'Nmap Scanner',
    category: 'Reconnaissance',
    description: 'Network discovery and security auditing',
    command: 'nmap -sV -sC',
    icon: <Network className="w-5 h-5" />
  },
  {
    id: 'gobuster',
    name: 'Gobuster',
    category: 'Reconnaissance',
    description: 'Directory and file brute-forcer',
    command: 'gobuster dir -u',
    icon: <Search className="w-5 h-5" />
  },
  {
    id: 'sqlmap',
    name: 'SQLMap',
    category: 'Exploitation',
    description: 'Automated SQL injection tool',
    command: 'sqlmap -u',
    icon: <Database className="w-5 h-5" />
  },
  {
    id: 'metasploit',
    name: 'Metasploit',
    category: 'Exploitation',
    description: 'Penetration testing framework',
    command: 'msfconsole',
    icon: <Target className="w-5 h-5" />
  },
  {
    id: 'nikto',
    name: 'Nikto',
    category: 'Scanner',
    description: 'Web server vulnerability scanner',
    command: 'nikto -h',
    icon: <Scan className="w-5 h-5" />
  },
  {
    id: 'burp',
    name: 'Burp Suite',
    category: 'Proxy',
    description: 'Web vulnerability scanner and proxy',
    command: 'burpsuite',
    icon: <Activity className="w-5 h-5" />
  },
  {
    id: 'wireshark',
    name: 'Wireshark',
    category: 'Network',
    description: 'Network protocol analyzer',
    command: 'wireshark',
    icon: <Wifi className="w-5 h-5" />
  },
  {
    id: 'aircrack',
    name: 'Aircrack-ng',
    category: 'Wireless',
    description: 'WiFi security auditing tools',
    command: 'aircrack-ng',
    icon: <Radio className="w-5 h-5" />
  },
  {
    id: 'john',
    name: 'John the Ripper',
    category: 'Password',
    description: 'Password cracking tool',
    command: 'john',
    icon: <Lock className="w-5 h-5" />
  },
  {
    id: 'hashcat',
    name: 'Hashcat',
    category: 'Password',
    description: 'Advanced password recovery',
    command: 'hashcat',
    icon: <Fingerprint className="w-5 h-5" />
  },
  {
    id: 'hydra',
    name: 'Hydra',
    category: 'Password',
    description: 'Network logon cracker',
    command: 'hydra -l',
    icon: <Zap className="w-5 h-5" />
  },
  {
    id: 'osint',
    name: 'OSINT Framework',
    category: 'Intelligence',
    description: 'Open source intelligence gathering',
    command: 'theHarvester -d',
    icon: <Eye className="w-5 h-5" />
  }
];

// Main App Component
function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('agent');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [darkMode, setDarkMode] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [terminalCommands, setTerminalCommands] = useState<TerminalCommand[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [selectedModel, setSelectedModel] = useState('llama2');
  const [availableModels] = useState<string[]>(['llama2', 'codellama', 'mistral']);
  const [terminalInput, setTerminalInput] = useState('');
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Translations
  const t = {
    en: {
      title: 'RudraX CyberSec',
      subtitle: 'A Lalit Pandit Product',
      agentMode: 'Agent Mode',
      securityTools: 'Security Tools',
      terminal: 'Terminal',
      files: 'Files',
      settings: 'Settings',
      chat: 'Chat',
      send: 'Send',
      processing: 'Processing...',
      stop: 'Stop',
      newTask: 'New Task',
      execute: 'Execute',
      save: 'Save',
      delete: 'Delete',
      download: 'Download',
      clear: 'Clear',
      copy: 'Copy',
      language: 'Language',
      darkMode: 'Dark Mode',
      ollamaUrl: 'Ollama URL',
      model: 'Model',
      refresh: 'Refresh',
      activeAgents: 'Active Agents',
      taskQueue: 'Task Queue',
      createFile: 'Create File',
      filename: 'Filename',
      content: 'Content',
      runCommand: 'Run Command',
      command: 'Command',
      output: 'Output',
      status: 'Status',
      completed: 'Completed',
      failed: 'Failed',
      pending: 'Pending',
      inProgress: 'In Progress',
      welcome: 'Welcome to RudraX CyberSec AI Agent System',
      placeholder: 'Enter your task or question...',
      terminalPlaceholder: 'Enter command...',
      thinking: 'Thinking...',
      analyzing: 'Analyzing task...',
      planning: 'Creating execution plan...',
      executing: 'Executing...',
      testing: 'Testing results...',
      delivering: 'Delivering final output...',
      retry: 'Retrying...',
      success: 'Task completed successfully!',
      error: 'Error occurred. Retrying...',
      noTasks: 'No tasks in queue',
      noFiles: 'No files created yet',
      noCommands: 'No commands executed yet',
      branding: 'Developed by Lalit Pandit'
    },
    hi: {
      title: 'RudraX CyberSec',
      subtitle: 'ललित पंडित द्वारा निर्मित',
      agentMode: 'एजेंट मोड',
      securityTools: 'सुरक्षा उपकरण',
      terminal: 'टर्मिनल',
      files: 'फाइलें',
      settings: 'सेटिंग्स',
      chat: 'चैट',
      send: 'भेजें',
      processing: 'प्रोसेसिंग...',
      stop: 'रोकें',
      newTask: 'नया कार्य',
      execute: 'चलाएं',
      save: 'सहेजें',
      delete: 'हटाएं',
      download: 'डाउनलोड',
      clear: 'साफ करें',
      copy: 'कॉपी',
      language: 'भाषा',
      darkMode: 'डार्क मोड',
      ollamaUrl: 'Ollama URL',
      model: 'मॉडल',
      refresh: 'रिफ्रेश',
      activeAgents: 'सक्रिय एजेंट',
      taskQueue: 'कार्य कतार',
      createFile: 'फाइल बनाएं',
      filename: 'फाइलनाम',
      content: 'सामग्री',
      runCommand: 'कमांड चलाएं',
      command: 'कमांड',
      output: 'आउटपुट',
      status: 'स्थिति',
      completed: 'पूरा हुआ',
      failed: 'विफल',
      pending: 'लंबित',
      inProgress: 'प्रगति में',
      welcome: 'RudraX CyberSec AI एजेंट सिस्टम में आपका स्वागत है',
      placeholder: 'अपना कार्य या प्रश्न दर्ज करें...',
      terminalPlaceholder: 'कमांड दर्ज करें...',
      thinking: 'सोच रहा है...',
      analyzing: 'कार्य का विश्लेषण...',
      planning: 'निष्पादन योजना बना रहा है...',
      executing: 'निष्पादन...',
      testing: 'परिणामों का परीक्षण...',
      delivering: 'अंतिम आउटपुट दे रहा है...',
      retry: 'पुनः प्रयास...',
      success: 'कार्य सफलतापूर्वक पूरा हुआ!',
      error: 'त्रुटि हुई। पुनः प्रयास कर रहा है...',
      noTasks: 'कतार में कोई कार्य नहीं',
      noFiles: 'अभी तक कोई फाइल नहीं बनी',
      noCommands: 'अभी तक कोई कमांड निष्पादित नहीं हुई',
      branding: 'ललित पंडित द्वारा विकसित'
    }
  };

  const currentLang = t[language];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalCommands]);

  // Add welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'system',
        content: currentLang.welcome,
        timestamp: new Date()
      }]);
    }
  }, []);

  // Simulate Ollama API call
  const callOllama = async (prompt: string, systemPrompt?: string) => {
    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: prompt,
          system: systemPrompt || '',
          stream: false
        })
      });
      
      if (!response.ok) {
        throw new Error('Ollama API error');
      }
      
      const data = await response.json();
      return data.response;
    } catch (error) {
      // Fallback to simulated response for demo
      return simulateAIResponse(prompt);
    }
  };

  // Simulated AI response for demo
  const simulateAIResponse = (prompt: string): string => {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('nmap') || lowerPrompt.includes('scan')) {
      return `Starting Nmap scan...
\`\`\`
Nmap scan report for target.example.com
Host is up (0.045s latency).
Not shown: 995 closed ports
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
3306/tcp open  mysql
8080/tcp open  http-proxy
\`\`\`
Scan completed. Found 5 open ports.`;
    }
    
    if (lowerPrompt.includes('code') || lowerPrompt.includes('script') || lowerPrompt.includes('python')) {
      return `I'll create a Python script for you. Let me generate the code:

\`\`\`python
#!/usr/bin/env python3
"""
Security Scanner Script
Generated by RudraX CyberSec AI
"""

import socket
import sys
from concurrent.futures import ThreadPoolExecutor

def scan_port(target, port):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((target, port))
        if result == 0:
            return f"Port {port}: OPEN"
        sock.close()
    except:
        pass
    return None

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    print(f"Scanning {target}...")
    
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(scan_port, target, port) for port in range(1, 1025)]
        for future in futures:
            result = future.result()
            if result:
                print(result)

if __name__ == "__main__":
    main()
\`\`\`

The script has been created and saved. You can run it with: \`python3 scanner.py <target>\``;
    }
    
    if (lowerPrompt.includes('sql') || lowerPrompt.includes('injection')) {
      return `SQL Injection vulnerability analysis:

1. **Identified Parameters:**
   - id (GET parameter)
   - username (POST parameter)
   - search (GET parameter)

2. **Test Payloads:**
   \`\`\`
   ' OR '1'='1
   ' UNION SELECT null,null--
   ' AND 1=1--
   \`\`\`

3. **Recommendations:**
   - Use parameterized queries
   - Implement input validation
   - Apply least privilege database access
   - Enable SQL query logging`;
    }
    
    return `I've analyzed your request. Here's my response:

Based on the task provided, I can help you with:

1. **Analysis**: Understanding the requirements and scope
2. **Planning**: Breaking down into actionable steps
3. **Execution**: Using appropriate tools and agents
4. **Testing**: Validating the results
5. **Delivery**: Providing the final output

Would you like me to proceed with any specific action? I can generate code, run security scans, analyze vulnerabilities, or help with infrastructure setup.`;
  };

  // Agent workflow handler
  const handleAgentWorkflow = async (userInput: string) => {
    setIsProcessing(true);
    
    // Step 1: Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    // Step 2: Create todo/plan
    const planTask: Task = {
      id: 'plan-' + Date.now(),
      title: currentLang.analyzing,
      status: 'in_progress',
      agent: 'planner',
      description: 'Analyzing user request and creating execution plan'
    };
    setTasks(prev => [...prev, planTask]);

    // Simulate planning delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 3: Determine which agent to use
    const lowerInput = userInput.toLowerCase();
    let targetAgent = 'coder';
    
    if (lowerInput.includes('security') || lowerInput.includes('scan') || lowerInput.includes('vulnerability') || lowerInput.includes('exploit')) {
      targetAgent = 'security';
    } else if (lowerInput.includes('test') || lowerInput.includes('debug') || lowerInput.includes('validate')) {
      targetAgent = 'tester';
    } else if (lowerInput.includes('server') || lowerInput.includes('deploy') || lowerInput.includes('infrastructure')) {
      targetAgent = 'infra';
    } else if (lowerInput.includes('web') || lowerInput.includes('api') || lowerInput.includes('http')) {
      targetAgent = 'web';
    }

    // Update plan task
    setTasks(prev => prev.map(t => 
      t.id === planTask.id ? { ...t, status: 'completed', title: 'Analysis complete' } : t
    ));

    // Step 4: Execute with selected agent
    const execTask: Task = {
      id: 'exec-' + Date.now(),
      title: currentLang.executing,
      status: 'in_progress',
      agent: targetAgent,
      description: `Executing task with ${AGENTS.find(a => a.id === targetAgent)?.name}`
    };
    setTasks(prev => [...prev, execTask]);

    // Get AI response
    const systemPrompt = `You are the ${AGENTS.find(a => a.id === targetAgent)?.name} of RudraX CyberSec AI system. Respond in ${language === 'hi' ? 'Hindi' : 'English'}.`;
    const response = await callOllama(userInput, systemPrompt);

    // Update exec task
    setTasks(prev => prev.map(t => 
      t.id === execTask.id ? { ...t, status: 'completed', title: 'Execution complete' } : t
    ));

    // Step 5: Test/validate (if needed)
    if (lowerInput.includes('code') || lowerInput.includes('script')) {
      const testTask: Task = {
        id: 'test-' + Date.now(),
        title: currentLang.testing,
        status: 'in_progress',
        agent: 'tester',
        description: 'Validating generated output'
      };
      setTasks(prev => [...prev, testTask]);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTasks(prev => prev.map(t => 
        t.id === testTask.id ? { ...t, status: 'completed', title: 'Validation complete' } : t
      ));
    }

    // Step 6: Deliver response
    const assistantMsg: Message = {
      id: 'resp-' + Date.now(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      agent: targetAgent
    };
    setMessages(prev => [...prev, assistantMsg]);

    setIsProcessing(false);
    toast.success(currentLang.success);
  };

  // Handle send message
  const handleSend = () => {
    if (!inputMessage.trim()) return;
    handleAgentWorkflow(inputMessage);
    setInputMessage('');
  };

  // Handle terminal command
  const handleTerminalCommand = async () => {
    if (!terminalInput.trim()) return;
    
    const cmd: TerminalCommand = {
      id: Date.now().toString(),
      command: terminalInput,
      output: '',
      status: 'running',
      timestamp: new Date()
    };
    
    setTerminalCommands(prev => [...prev, cmd]);
    setTerminalInput('');

    // Simulate command execution
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    let output = '';
    const lowerCmd = terminalInput.toLowerCase();
    
    if (lowerCmd.includes('ls') || lowerCmd.includes('dir')) {
      output = `total 24
drwxr-xr-x 4 user user 4096 Jan 15 10:30 .
drwxr-xr-x 18 user user 4096 Jan 15 10:25 ..
-rw-r--r-- 1 user user  220 Jan 15 10:25 .bash_logout
-rw-r--r-- 1 user user 3771 Jan 15 10:25 .bashrc
drwxr-xr-x 3 user user 4096 Jan 15 10:30 projects
drwxr-xr-x 2 user user 4096 Jan 15 10:28 scripts`;
    } else if (lowerCmd.includes('pwd')) {
      output = '/home/user/workspace';
    } else if (lowerCmd.includes('whoami')) {
      output = 'rudrax-user';
    } else if (lowerCmd.includes('uname')) {
      output = 'Linux rudrax-server 5.15.0-generic #1 SMP x86_64 GNU/Linux';
    } else if (lowerCmd.includes('nmap')) {
      output = `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for localhost (127.0.0.1)
Host is up (0.0001s latency).
Not shown: 995 closed ports
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
3306/tcp open  mysql
5432/tcp open  postgresql
8080/tcp open  http-proxy

Nmap done: 1 IP address (1 host up) scanned in 0.45 seconds`;
    } else if (lowerCmd.includes('python') || lowerCmd.includes('node')) {
      output = `Script executed successfully.
Output: Process completed with exit code 0`;
    } else {
      output = `Command executed: ${terminalInput}
Output: Success`;
    }

    setTerminalCommands(prev => prev.map(c => 
      c.id === cmd.id ? { ...c, output, status: 'completed' } : c
    ));
  };

  // Create new file
  const handleCreateFile = () => {
    if (!currentFile?.name) return;
    
    const newFile: FileItem = {
      id: Date.now().toString(),
      name: currentFile.name,
      type: 'file',
      content: fileContent,
      size: `${(fileContent.length / 1024).toFixed(2)} KB`,
      modified: new Date()
    };
    
    setFiles(prev => [...prev, newFile]);
    setCurrentFile(null);
    setFileContent('');
    toast.success('File created successfully');
  };

  // Delete file
  const handleDeleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    toast.success('File deleted');
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Run security tool
  const runSecurityTool = async (tool: SecurityTool) => {
    const cmd: TerminalCommand = {
      id: Date.now().toString(),
      command: `${tool.command} [target]`,
      output: `Starting ${tool.name}...
${tool.description}

This would execute: ${tool.command}

[Simulation Mode - Connect to Ollama for real execution]`,
      status: 'completed',
      timestamp: new Date()
    };
    
    setTerminalCommands(prev => [...prev, cmd]);
    setActiveTab('terminal');
    toast.info(`${tool.name} launched`);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-background text-foreground">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="border-b bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
              <div className="flex items-center gap-3">
                <img 
                  src="/logo.png" 
                  alt="RudraX" 
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                    {currentLang.title}
                  </h1>
                  <p className="text-xs text-muted-foreground">{currentLang.subtitle}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Cpu className="w-3 h-3" />
                Ollama Connected
              </Badge>
              <Select value={language} onValueChange={(v: 'en' | 'hi') => setLanguage(v)}>
                <SelectTrigger className="w-24">
                  <Languages className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">हिंदी</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}>
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          {sidebarOpen && (
            <aside className="w-64 border-r bg-card min-h-[calc(100vh-65px)]">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  <Button 
                    variant={activeTab === 'agent' ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2"
                    onClick={() => setActiveTab('agent')}
                  >
                    <Brain className="w-4 h-4" />
                    {currentLang.agentMode}
                  </Button>
                  <Button 
                    variant={activeTab === 'security' ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2"
                    onClick={() => setActiveTab('security')}
                  >
                    <Shield className="w-4 h-4" />
                    {currentLang.securityTools}
                  </Button>
                  <Button 
                    variant={activeTab === 'terminal' ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2"
                    onClick={() => setActiveTab('terminal')}
                  >
                    <Terminal className="w-4 h-4" />
                    {currentLang.terminal}
                  </Button>
                  <Button 
                    variant={activeTab === 'files' ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2"
                    onClick={() => setActiveTab('files')}
                  >
                    <FileCode className="w-4 h-4" />
                    {currentLang.files}
                  </Button>
                  <Button 
                    variant={activeTab === 'settings' ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2"
                    onClick={() => setActiveTab('settings')}
                  >
                    <Settings className="w-4 h-4" />
                    {currentLang.settings}
                  </Button>
                </div>

                <Separator className="my-4" />

                {/* Active Agents */}
                <div className="px-4 pb-4">
                  <h3 className="text-sm font-semibold mb-3">{currentLang.activeAgents}</h3>
                  <div className="space-y-2">
                    {AGENTS.map(agent => (
                      <div 
                        key={agent.id} 
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedAgent === agent.id ? 'bg-primary/20' : 'hover:bg-muted'
                        }`}
                        onClick={() => setSelectedAgent(agent.id)}
                      >
                        <div className={`${agent.color} p-1.5 rounded text-white`}>
                          {agent.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{agent.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
                        </div>
                        {agent.active && (
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Task Queue */}
                <div className="px-4 pb-4">
                  <h3 className="text-sm font-semibold mb-3">{currentLang.taskQueue}</h3>
                  <div className="space-y-2">
                    {tasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{currentLang.noTasks}</p>
                    ) : (
                      tasks.slice(-5).map(task => (
                        <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          {task.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : task.status === 'failed' ? (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          ) : task.status === 'in_progress' ? (
                            <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{task.agent}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </ScrollArea>
            </aside>
          )}

          {/* Main Content */}
          <main className="flex-1 min-h-[calc(100vh-65px)]">
            {/* Agent Mode */}
            {activeTab === 'agent' && (
              <div className="flex flex-col h-[calc(100vh-65px)]">
                {/* Chat Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4 max-w-4xl mx-auto">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role !== 'user' && (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            msg.role === 'system' ? 'bg-gradient-to-br from-cyan-500 to-blue-600' : 
                            AGENTS.find(a => a.id === msg.agent)?.color || 'bg-primary'
                          }`}>
                            {msg.role === 'system' ? <Zap className="w-4 h-4 text-white" /> : 
                             AGENTS.find(a => a.id === msg.agent)?.icon || <Brain className="w-4 h-4 text-white" />}
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl p-4 ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground rounded-br-sm' 
                            : msg.role === 'system'
                            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/30'
                            : 'bg-card border rounded-bl-sm'
                        }`}>
                          {msg.agent && (
                            <Badge variant="outline" className="mb-2 text-xs">
                              {AGENTS.find(a => a.id === msg.agent)?.name}
                            </Badge>
                          )}
                          <div className="whitespace-pre-wrap text-sm">
                            {msg.content.split('```').map((part, i) => (
                              i % 2 === 0 ? (
                                <span key={i}>{part}</span>
                              ) : (
                                <div key={i} className="relative my-2">
                                  <div className="absolute top-2 right-2 flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6"
                                      onClick={() => handleCopy(part)}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <pre className="bg-black/50 rounded-lg p-3 overflow-x-auto text-xs font-mono">
                                    <code>{part}</code>
                                  </pre>
                                </div>
                              )
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {msg.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isProcessing && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center animate-pulse">
                          <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-card border rounded-2xl rounded-bl-sm p-4">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 animate-spin" />
                            <span className="text-sm">{currentLang.thinking}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t bg-card p-4">
                  <div className="max-w-4xl mx-auto flex gap-2">
                    <Textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={currentLang.placeholder}
                      className="min-h-[80px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <div className="flex flex-col gap-2">
                      <Button 
                        onClick={handleSend} 
                        disabled={isProcessing || !inputMessage.trim()}
                        className="h-10"
                      >
                        {isProcessing ? <Pause className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setMessages([]);
                          setTasks([]);
                        }}
                        className="h-10"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tools */}
            {activeTab === 'security' && (
              <ScrollArea className="h-[calc(100vh-65px)] p-6">
                <div className="max-w-6xl mx-auto">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Shield className="w-6 h-6" />
                      {currentLang.securityTools}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      Professional security testing and penetration testing tools
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SECURITY_TOOLS.map((tool) => (
                      <Card key={tool.id} className="hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="p-2 rounded-lg bg-primary/10">
                              {tool.icon}
                            </div>
                            <Badge variant="secondary">{tool.category}</Badge>
                          </div>
                          <CardTitle className="text-lg mt-3">{tool.name}</CardTitle>
                          <CardDescription>{tool.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <code className="text-xs bg-muted p-2 rounded block mb-3">
                            {tool.command}
                          </code>
                          <Button 
                            className="w-full gap-2"
                            onClick={() => runSecurityTool(tool)}
                          >
                            <Play className="w-4 h-4" />
                            Launch Tool
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            )}

            {/* Terminal */}
            {activeTab === 'terminal' && (
              <div className="flex flex-col h-[calc(100vh-65px)] bg-black">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    <span className="text-sm font-medium">Terminal</span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setTerminalCommands([])}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {currentLang.clear}
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="flex-1 p-4 font-mono text-sm">
                  <div className="space-y-4">
                    {terminalCommands.length === 0 ? (
                      <p className="text-muted-foreground">{currentLang.noCommands}</p>
                    ) : (
                      terminalCommands.map((cmd) => (
                        <div key={cmd.id} className="space-y-2">
                          <div className="flex items-center gap-2 text-green-400">
                            <span className="text-muted-foreground">
                              [{cmd.timestamp.toLocaleTimeString()}]
                            </span>
                            <span>rudrax@server:~$</span>
                            <span className="text-white">{cmd.command}</span>
                          </div>
                          {cmd.output && (
                            <div className="pl-4 text-gray-300 whitespace-pre-wrap">
                              {cmd.output}
                            </div>
                          )}
                          {cmd.status === 'running' && (
                            <div className="flex items-center gap-2 text-blue-400">
                              <Activity className="w-4 h-4 animate-spin" />
                              <span>Running...</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-4 border-t bg-card">
                  <div className="flex gap-2">
                    <span className="text-green-400 font-mono">rudrax@server:~$</span>
                    <Input
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      placeholder={currentLang.terminalPlaceholder}
                      className="flex-1 font-mono bg-transparent border-0 focus-visible:ring-0"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTerminalCommand();
                        }
                      }}
                    />
                    <Button onClick={handleTerminalCommand}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Files */}
            {activeTab === 'files' && (
              <ScrollArea className="h-[calc(100vh-65px)] p-6">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <FileCode className="w-6 h-6" />
                      {currentLang.files}
                    </h2>
                    <Dialog>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{currentLang.createFile}</DialogTitle>
                          <DialogDescription>Create a new file</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>{currentLang.filename}</Label>
                            <Input 
                              placeholder="script.py"
                              onChange={(e) => setCurrentFile({ 
                                id: 'new', 
                                name: e.target.value, 
                                type: 'file', 
                                modified: new Date() 
                              })}
                            />
                          </div>
                          <div>
                            <Label>{currentLang.content}</Label>
                            <Textarea 
                              className="min-h-[200px] font-mono"
                              placeholder="# Enter your code here..."
                              value={fileContent}
                              onChange={(e) => setFileContent(e.target.value)}
                            />
                          </div>
                          <Button onClick={handleCreateFile} className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            {currentLang.createFile}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button onClick={() => document.querySelector('dialog')?.showModal()}>
                      <Plus className="w-4 h-4 mr-2" />
                      {currentLang.createFile}
                    </Button>
                  </div>

                  {files.length === 0 ? (
                    <Card className="p-8 text-center">
                      <FileCode className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">{currentLang.noFiles}</p>
                    </Card>
                  ) : (
                    <div className="grid gap-2">
                      {files.map((file) => (
                        <Card key={file.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-blue-500" />
                              <div>
                                <p className="font-medium">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {file.size} • {file.modified.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleCopy(file.content || '')}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteFile(file.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Settings */}
            {activeTab === 'settings' && (
              <ScrollArea className="h-[calc(100vh-65px)] p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Settings className="w-6 h-6" />
                      {currentLang.settings}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      Configure your RudraX CyberSec AI system
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Ollama Configuration</CardTitle>
                      <CardDescription>Connect to your local Ollama instance</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>{currentLang.ollamaUrl}</Label>
                        <div className="flex gap-2">
                          <Input 
                            value={ollamaUrl}
                            onChange={(e) => setOllamaUrl(e.target.value)}
                            placeholder="http://localhost:11434"
                          />
                          <Button variant="outline">
                            <Check className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>{currentLang.model}</Label>
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map(model => (
                              <SelectItem key={model} value={model}>{model}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Appearance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>{currentLang.darkMode}</Label>
                          <p className="text-sm text-muted-foreground">Toggle dark theme</p>
                        </div>
                        <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>{currentLang.language}</Label>
                          <p className="text-sm text-muted-foreground">Select interface language</p>
                        </div>
                        <Select value={language} onValueChange={(v: 'en' | 'hi') => setLanguage(v)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="hi">हिंदी</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Agent Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {AGENTS.map(agent => (
                          <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                            <div className="flex items-center gap-3">
                              <div className={`${agent.color} p-1.5 rounded text-white`}>
                                {agent.icon}
                              </div>
                              <div>
                                <p className="font-medium">{agent.name}</p>
                                <p className="text-xs text-muted-foreground">{agent.description}</p>
                              </div>
                            </div>
                            <Switch checked={agent.active} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="text-center pt-6 pb-4">
                    <p className="text-sm text-muted-foreground">{currentLang.branding}</p>
                    <p className="text-xs text-muted-foreground mt-1">© 2025 RudraX CyberSec. All rights reserved.</p>
                  </div>
                </div>
              </ScrollArea>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
