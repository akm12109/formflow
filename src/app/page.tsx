'use client';
import { useState, useRef, useEffect } from 'react';
import Header from '@/components/app/header';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Download, Terminal, Upload, Copy, FileCode, Sparkles, Link as LinkIcon, Rocket } from 'lucide-react';
import { FormRecord } from '@/lib/types';
import RecordForm from '@/components/app/record-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import withAuth from '@/components/auth/withAuth';
import { usePresence } from '@/hooks/use-presence';
import { useAuth } from '@/components/auth/auth-provider';
import { generateRecord } from '@/ai/flows/generate-record-flow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getFunctions, httpsCallable } from 'firebase/functions';

const exampleJson = {
  records: [
    {
      "name": "Aarti",
      "age": "26",
      "gender": "Female",
      "maritalStatus": "Never Married",
      "education": "B.Com",
      "occupation": "Production Manager",
      "religion": "Christian",
      "caste": "D'Souza",
      "gothra": "Francis",
      "motherTongue": "Punjabi",
      "horoscopeMatch": "Yes",
      "star": "Ashwini",
      "raasiMoonSign": "Aries",
      "doshamManglik": "No",
      "heightFeet": "5 ft",
      "heightInches": "7 in",
      "heightCms": "170 cm",
      "weightKg": "76 kg",
      "weightLbs": "138 lbs",
      "citizenship": "India",
      "homeState": "Karnataka",
      "bodyType": "Heavy",
      "complexion": "Fair",
      "physicalStatus": "Normal",
      "eatingHabit": "Vegetarian",
      "drinkingHabit": "No",
      "smokingHabit": "Occasionally",
      "familyValue": "Moderate",
      "familyType": "Nuclear",
      "familyStatus": "Middle Class",
      "annualIncome": "22 LPA",
      "aboutParentsSiblings": "I have two sisters; we share a very close bond and support each other in every step of life.",
      "moreAboutSelf": "I consider myself ambitious, currently working as a manager and passionate about sports.",
      "yourExpectation": "Looking for a partner who is loving and values trust.",
      "email": "12345_Aarti@nitresearchcenter.com",
      "retypeEmail": "12345_Aarti@nitresearchcenter.com",
      "password": "Aarti@1234",
      "retypePassword": "Aarti@1234",
      "educationDetails": "B.Com",
      "subCaste": "D'Souza",
      "homeCityDistrict": "Karnataka",
      "countryLivingIn": "India",
      "stateCityLivingIn": "Karnataka",
      "howToKnowAboutUs": "My Friend"
    }
  ]
};

const examplePrompt = `Generate a JSON object with a key "records" which is an array containing one or more records. Each record should follow this structure and data types:
formNo=

name: string
age: string
gender: string
education: string
occupation: string
religion: string (Accepted values: "Hindu", "Muslim", "Sikh", "Christian", "Other")
caste: string
gothra: string
motherTongue: string
horoscopeMatch: string
star: string (Accepted values: "Ashwini", "Bharani", "Krittika", "Other")
raasiMoonSign: string
doshamManglik: string ("Yes", "No", "Other")
heightFeet: string
heightInches: string
heightCms: string
weightKg: string
weightLbs: string
citizenship: string (MUST be one of: "India", "USA", "Canada")
homeState: string
bodyType: string ("Slim" ,"Average", "Athletic", "Heavy" "Other")
complexion: string
physicalStatus: string
eatingHabit: string ("Vegetarian", "Non-Vegetarian", "Eggetarian", "Others")
drinkingHabit: string
smokingHabit: string ("No", "Occasionally", "Yes", "Other")
familyValue: string ("Other", "Traditional", "Moderate", "Liberal")
familyType: string ("Joint", "Nuclear")
familyStatus: string
annualIncome: string
aboutParentsSiblings: string(add full stop at last of sentence (.))
moreAboutSelf: string (add full stop at last of sentence (.))
yourExpectation: string(add full stop at last of sentence (.))
The following fields MUST be derived from other fields:

email: string (e.g., formNo_Name@nitresearchcenter.com)
retypeEmail: string (must match email)
password: string (e.g., Name@1234)
retypePassword: string (must match password)
educationDetails: string (same as education)
subCaste: string (same as caste)
homeCityDistrict: string (same as homeState)
countryLivingIn: string (MUST be the same as citizenship)
stateCityLivingIn: string (same as homeState)
howToKnowAboutUs: string "My Friend"
Here is an example of the final JSON structure:
${JSON.stringify(exampleJson, null, 2)}
`;


function Dashboard() {
  const { user } = useAuth();
  const [extractedData, setExtractedData] = useState<{records: FormRecord[]} | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for AI generation
  const [formNo, setFormNo] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // State for Iframe
  const [iframeUrl, setIframeUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');

  // State for Automation
  const [automating, setAutomating] = useState(false);

  usePresence(user?.uid, user?.email);

  const { toast } = useToast();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);
  
  const handleJsonChange = (jsonString: string) => {
    setJsonText(jsonString);
    try {
      if (jsonString.trim() === '') {
        setExtractedData(null);
        setJsonError(null);
        return;
      }
      const parsed = JSON.parse(jsonString);
      if (parsed && Array.isArray(parsed.records)) {
        setExtractedData(parsed);
        setJsonError(null);
      } else {
        setJsonError("Invalid JSON structure. It must be an object with a 'records' array.");
      }
    } catch (e: any) {
      setJsonError(`Invalid JSON: ${e.message}`);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please upload a valid .json file.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleJsonChange(text);
    };
    reader.readAsText(file);
  };
  
  const handleDownloadJson = () => {
    if (!extractedData) return;

    const jsonString = JSON.stringify(extractedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_data.json';
    document.body.appendChild(a);
a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyExample = () => {
    navigator.clipboard.writeText(examplePrompt);
    toast({
      title: 'Copied to Clipboard',
      description: 'The example AI prompt has been copied.',
    });
  };

  const handleCopyScript = () => {
    if (!extractedData || !extractedData.records || extractedData.records.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Data',
            description: 'There is no data to generate a script from.',
        });
        return;
    }

    const firstRecord = extractedData.records[0];
    let script = '/*-- Paste this script into the browser console of the target website --*/\n\n';
    
    script += `const record = ${JSON.stringify(firstRecord, null, 2)};\n\n`;
    script += `const fillField = (selector, value) => {
        if (!selector || value === undefined || value === null) return;
        const element = document.querySelector(selector);
        if (element) {
            if (element.tagName === 'SELECT') {
                const option = Array.from(element.options).find(opt => opt.value === value || opt.text === value);
                if (option) option.selected = true;
            } else {
                element.value = value;
            }
        }
    };\n\n`;

    script += `// --- Field Selectors (Update these to match the target website's form) --- \n`;
    script += `const selectors = {\n`;
    for (const key in firstRecord) {
        if (Object.prototype.hasOwnProperty.call(firstRecord, key)) {
            // Assume ID is the same as the key, user needs to change this
            script += `    ${key}: '#${key}',\n`;
        }
    }
    script += `};\n\n`;
    
    script += `// --- Fill Form --- \n`;
    script += `for (const key in selectors) {
        if (record[key]) {
            fillField(selectors[key], record[key]);
        }
    }`;
  
    navigator.clipboard.writeText(script);
    toast({
      title: 'Script Copied',
      description: 'A more advanced script has been copied. You may need to edit the CSS selectors.',
    });
  };


  const handleGenerate = async () => {
    if (!formNo || !description) {
        toast({
            variant: 'destructive',
            title: 'Missing Information',
            description: 'Please provide both a Form No. and a description.',
        });
        return;
    }
    setGenerating(true);
    setJsonError(null);
    try {
        const result = await generateRecord({ formNo, description });
        const resultJson = { records: [result] };
        handleJsonChange(JSON.stringify(resultJson, null, 2));
        toast({
            title: 'Record Generated',
            description: 'The JSON has been generated and populated below.',
        });
        setCooldown(15); // Start 15-second cooldown
    } catch (e: any) {
        console.error('Error generating record:', e);
        setJsonError(`AI Generation Failed: ${e.message}`);
        toast({
            variant: 'destructive',
            title: 'AI Generation Error',
            description: 'Could not generate the record. Please check the console.',
        });
    } finally {
        setGenerating(false);
    }
  };

  const handleLoadUrl = () => {
    if (inputUrl) {
      if (!/^https?:\/\//i.test(inputUrl)) {
        setIframeUrl('https://' + inputUrl);
      } else {
        setIframeUrl(inputUrl);
      }
    }
  };

  const handleStartAutomation = async () => {
    if (!inputUrl) {
      toast({ variant: 'destructive', title: 'URL Missing', description: 'Please enter a target website URL to start the automation.' });
      return;
    }
    if (!extractedData || !extractedData.records || extractedData.records.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'Please generate or upload JSON data before starting automation.' });
      return;
    }

    setAutomating(true);
    toast({ title: 'Automation Started', description: 'The server is now processing your records. This may take a few minutes.' });

    try {
      const functions = getFunctions();
      const runFormAutomation = httpsCallable(functions, 'runFormAutomation');
      const result = await runFormAutomation({
        targetUrl: inputUrl,
        records: extractedData.records,
      });
      
      console.log('Automation result:', result.data);
      toast({
        title: 'Automation Complete',
        description: `Server finished processing. Check the submission logs in the admin panel for details.`,
      });

    } catch (error: any) {
      console.error('Error calling Cloud Function:', error);
      toast({
        variant: 'destructive',
        title: 'Automation Failed',
        description: error.message || 'An unknown error occurred on the server.',
      });
    } finally {
      setAutomating(false);
    }
  };
  
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Generate Record with AI</CardTitle>
                    <CardDescription>
                        Provide a Form Number and a description of the person to generate the JSON record.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="formNo">Form Number</Label>
                        <Input 
                            id="formNo" 
                            type="number"
                            placeholder="e.g., 12345"
                            value={formNo}
                            onChange={(e) => setFormNo(e.target.value)}
                            disabled={generating || cooldown > 0}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Person Description</Label>
                        <Textarea 
                            id="description" 
                            placeholder="e.g., 'A 28 year old software engineer from Delhi, Hindu, enjoys hiking and reading...'"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[100px]"
                            disabled={generating || cooldown > 0}
                        />
                    </div>
                    <Button onClick={handleGenerate} disabled={generating || cooldown > 0}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {generating ? 'Generating...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Generate'}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Provide JSON Data</CardTitle>
                        <CardDescription>
                            Paste your JSON data below or upload a JSON file.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopyExample}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy AI Prompt
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload JSON
                        </Button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".json"
                        onChange={handleFileUpload}
                    />
                </CardHeader>
                <CardContent>
                    <Textarea
                        placeholder={`Paste your JSON here...`}
                        className="min-h-[250px] font-mono"
                        value={jsonText}
                        onChange={(e) => handleJsonChange(e.target.value)}
                    />
                </CardContent>
            </Card>
          
          {jsonError && (
            <Alert variant="destructive" className="mb-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>JSON Error</AlertTitle>
                <AlertDescription>
                    {jsonError}
                </AlertDescription>
            </Alert>
          )}

          {extractedData && !jsonError && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Visualize and Edit Data</CardTitle>
                  <CardDescription>
                    Here is the data. You can edit the JSON above to see changes reflected below.
                  </CardDescription>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={handleCopyScript} disabled={!extractedData}>
                      <FileCode className="mr-2 h-4 w-4" />
                      Copy Script
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadJson} disabled={!extractedData}>
                      <Download className="mr-2 h-4 w-4" />
                      Download JSON
                    </Button>
                </div>
              </CardHeader>
              <CardContent>
                 {extractedData.records && extractedData.records.length > 0 && (
                 <Tabs defaultValue="record-0" className="mt-4">
                    <TabsList>
                      {extractedData.records.map((_, index) => (
                        <TabsTrigger key={index} value={`record-${index}`}>
                          Record {index + 1}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                     {extractedData.records.map((record, index) => (
                      <TabsContent key={index} value={`record-${index}`}>
                        <RecordForm record={record} />
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </CardContent>
            </Card>
          )}
           <Card>
                <CardHeader>
                    <CardTitle>Test & Automate</CardTitle>
                    <CardDescription>
                        Enter a URL to view the website, then click "Start Automation" to run the process on the server.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Input 
                            id="urlInput" 
                            placeholder="https://example.com"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
                        />
                         <Button onClick={handleLoadUrl} variant="secondary">
                            <LinkIcon className="mr-2 h-4 w-4" />
                            Load Website
                        </Button>
                         <Button onClick={handleStartAutomation} disabled={automating || !inputUrl || !extractedData}>
                            <Rocket className="mr-2 h-4 w-4" />
                            {automating ? 'Running...' : 'Start Automation'}
                        </Button>
                    </div>
                    {iframeUrl && (
                        <div className="h-[75vh] w-full rounded-md border bg-muted">
                             <iframe
                                src={iframeUrl}
                                className="h-full w-full"
                                title="Website Viewer"
                                allow="fullscreen"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}

export default withAuth(Dashboard);
