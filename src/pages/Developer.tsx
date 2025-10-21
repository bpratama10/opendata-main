import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApiKeys, ApiKey } from "@/hooks/useApiKeys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Copy, Key, Plus, Trash2, Eye, EyeOff, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface ApiKeyUsageCardProps {
  apiKey: ApiKey;
}

const ApiKeyUsageCard: React.FC<ApiKeyUsageCardProps> = ({ apiKey }) => {
  const { useApiKeyUsage } = useApiKeys();
  const { data: usage = [], isLoading: usageLoading } = useApiKeyUsage(apiKey.id);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-medium">{apiKey.name}</h4>
          <p className="text-sm text-gray-500">{apiKey.description || "No description"}</p>
        </div>
        <Badge variant={apiKey.is_active ? "default" : "secondary"}>
          {apiKey.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold">{usage.length}</div>
          <div className="text-sm text-gray-500">Total Requests</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{apiKey.rate_limit_requests}</div>
          <div className="text-sm text-gray-500">Rate Limit (per {apiKey.rate_limit_window_minutes}min)</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">
            {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString() : "Never"}
          </div>
          <div className="text-sm text-gray-500">Last Used</div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <strong>Recent Activity:</strong>
        {usageLoading ? (
          <span className="ml-2">Loading...</span>
        ) : usage.length > 0 ? (
          <span className="ml-2">
            Last request: {new Date(usage[0].requested_at).toLocaleString()}
          </span>
        ) : (
          <span className="ml-2">No recent activity</span>
        )}
      </div>
    </div>
  );
};

const Developer: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const {
    apiKeys,
    isLoading,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    isCreating,
    isUpdating,
    isDeleting,
    useApiKeyUsage
  } = useApiKeys();

  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDescription, setNewKeyDescription] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Key className="mx-auto h-16 w-16 text-gray-400" />
            <h1 className="mt-4 text-3xl font-bold text-gray-900">Developer Portal</h1>
            <p className="mt-2 text-lg text-gray-600">
              Access our API to programmatically interact with our data platform
            </p>
            <div className="mt-8">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You must be logged in to access the Developer Portal and manage API keys.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const { apiKey, apiKeyData } = await createApiKey({
        name: newKeyName.trim(),
        description: newKeyDescription.trim() || undefined,
      });

      setCreatedApiKey(apiKey);
      setShowCreatedKey(true);
      setNewKeyName("");
      setNewKeyDescription("");
      setShowCreateDialog(false);

      toast.success("API key created successfully!");
    } catch (error) {
      console.error("Error creating API key:", error);
      toast.error("Failed to create API key. Please try again.");
    }
  };

  const handleDeleteApiKey = async (apiKeyId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteApiKey(apiKeyId);
      toast.success("API key deleted successfully!");
    } catch (error) {
      console.error("Error deleting API key:", error);
      toast.error("Failed to delete API key. Please try again.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Developer Portal</h1>
          <p className="mt-2 text-lg text-gray-600">
            Manage API keys and access our programmatic endpoints
          </p>
        </div>

        <Tabs defaultValue="keys" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="documentation">API Documentation</TabsTrigger>
            <TabsTrigger value="usage">Usage & Analytics</TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Your API Keys</CardTitle>
                    <CardDescription>
                      Manage API keys for accessing our platform programmatically
                    </CardDescription>
                  </div>
                  <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create API Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New API Key</DialogTitle>
                        <DialogDescription>
                          Generate a new API key for programmatic access to our platform.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="keyName">Key Name</Label>
                          <Input
                            id="keyName"
                            placeholder="e.g., Production App"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="keyDescription">Description (Optional)</Label>
                          <Textarea
                            id="keyDescription"
                            placeholder="What is this key used for?"
                            value={newKeyDescription}
                            onChange={(e) => setNewKeyDescription(e.target.value)}
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateApiKey}
                          disabled={isCreating || !newKeyName.trim()}
                        >
                          {isCreating ? "Creating..." : "Create Key"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading API keys...</div>
                ) : apiKeys.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No API keys</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Get started by creating your first API key.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Rate Limit</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="font-medium">{key.name}</TableCell>
                          <TableCell>{key.description || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={key.is_active ? "default" : "secondary"}>
                              {key.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {key.rate_limit_requests} requests per {key.rate_limit_window_minutes} minutes
                          </TableCell>
                          <TableCell>
                            {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteApiKey(key.id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Show Created Key Dialog */}
                <Dialog open={showCreatedKey} onOpenChange={setShowCreatedKey}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>API Key Created Successfully</DialogTitle>
                      <DialogDescription>
                        Copy this API key now. You won't be able to see it again!
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                          <p className="text-sm font-medium text-yellow-800">
                            Store this key securely. It provides programmatic access to your data.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Your API Key</Label>
                        <div className="flex space-x-2">
                          <Input
                            readOnly
                            value={createdApiKey || ""}
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(createdApiKey || "")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setShowCreatedKey(false)}>
                        I have copied the key
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Documentation Tab */}
          <TabsContent value="documentation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Documentation</CardTitle>
                <CardDescription>
                  Complete guide for using our REST API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Authentication */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Authentication</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2">API Key Authentication</p>
                    <p className="text-sm text-gray-600 mb-3">
                      Include your API key in the Authorization header:
                    </p>
                    <code className="block bg-gray-800 text-white p-3 rounded text-sm">
                      Authorization: Bearer your-api-key-here
                    </code>
                  </div>
                </div>

                {/* Endpoints */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Endpoints</h3>

                  {/* Datasets List */}
                  <div className="border rounded-lg mb-4">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <code className="text-sm font-mono">GET /api/v1/datasets</code>
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Public</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard("GET /api/v1/datasets")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-gray-600 mb-2">List available datasets</p>
                      <div className="space-y-1 text-xs">
                        <p><strong>Parameters:</strong></p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                          <li><code>q</code> - Search query (optional)</li>
                          <li><code>limit</code> - Maximum results (default: 50, max: 100)</li>
                          <li><code>offset</code> - Pagination offset (default: 0)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Dataset by Slug */}
                  <div className="border rounded-lg">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <code className="text-sm font-mono">GET /api/v1/datasets/{'{slug}'}</code>
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Public</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard("GET /api/v1/datasets/{slug}")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-gray-600">Get detailed information about a specific dataset</p>
                    </div>
                  </div>

                </div>

                {/* Code Examples */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Code Examples</h3>

                  <Tabs defaultValue="javascript">
                    <TabsList>
                      <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                      <TabsTrigger value="python">Python</TabsTrigger>
                      <TabsTrigger value="curl">cURL</TabsTrigger>
                    </TabsList>

                    <TabsContent value="javascript" className="mt-4">
                      <pre className="bg-gray-800 text-white p-4 rounded-lg text-sm overflow-x-auto">
{`// List datasets
const response = await fetch('/api/v1/datasets', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your-api-key-here'
  }
});

const data = await response.json();
console.log(data);`}
                      </pre>
                    </TabsContent>

                    <TabsContent value="python" className="mt-4">
                      <pre className="bg-gray-800 text-white p-4 rounded-lg text-sm overflow-x-auto">
{`import requests

# List datasets
response = requests.get('/api/v1/datasets', headers={
    'Authorization': 'Bearer your-api-key-here'
})

data = response.json()
print(data)`}
                      </pre>
                    </TabsContent>

                    <TabsContent value="curl" className="mt-4">
                      <pre className="bg-gray-800 text-white p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X GET "/api/v1/datasets" \\
  -H "Authorization: Bearer your-api-key-here"`}
                      </pre>
                    </TabsContent>

                  </Tabs>

                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage & Analytics Tab */}
          <TabsContent value="usage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Usage Analytics</CardTitle>
                <CardDescription>
                  Monitor your API usage and rate limiting
                </CardDescription>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No API keys</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Create an API key to see usage analytics.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {apiKeys.map((key) => (
                      <ApiKeyUsageCard key={key.id} apiKey={key} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default Developer;
