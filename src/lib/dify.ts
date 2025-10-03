interface DifyDataset {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface DifyDocument {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export class DifyClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.DIFY_API_BASE!;
    this.apiKey = process.env.DIFY_API_KEY!;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async listDatasets(): Promise<DifyDataset[]> {
    return this.request('/datasets');
  }

  async getDataset(id: string): Promise<DifyDataset> {
    return this.request(`/datasets/${id}`);
  }

  async createDataset(name: string, description?: string): Promise<DifyDataset> {
    return this.request('/datasets', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async listDocuments(datasetId: string): Promise<DifyDocument[]> {
    return this.request(`/datasets/${datasetId}/documents`);
  }

  async createDocument(
    datasetId: string, 
    name: string, 
    content: string
  ): Promise<DifyDocument> {
    return this.request(`/datasets/${datasetId}/documents`, {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    });
  }
}

export const difyClient = new DifyClient();

