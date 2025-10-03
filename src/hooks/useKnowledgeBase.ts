import { useState, useEffect } from 'react';
import { KBSource, FAQ, CrawlJob } from '@/lib/types';

export function useKnowledgeBase() {
  const [sources, setSources] = useState<KBSource[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/kb/source');
      const data = await response.json();
      if (response.ok) {
        setSources(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch sources');
    }
  };

  const fetchFaqs = async () => {
    try {
      const response = await fetch('/api/kb/faqs');
      const data = await response.json();
      if (response.ok) {
        setFaqs(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch FAQs');
    }
  };

  const createSource = async (sourceData: Omit<KBSource, 'id' | 'created_at' | 'created_by'>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/kb/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceData)
      });
      
      const data = await response.json();
      if (response.ok) {
        setSources([data, ...sources]);
        return { success: true, data };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Failed to create source';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const startCrawl = async (sourceId: string, mode: 'direct' | 'n8n') => {
    setLoading(true);
    try {
      const response = await fetch('/api/kb/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, mode })
      });
      
      const data = await response.json();
      if (response.ok) {
        return { success: true, jobId: data.jobId };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Failed to start crawl';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const createFaq = async (faqData: Omit<FAQ, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/kb/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(faqData)
      });
      
      const data = await response.json();
      if (response.ok) {
        setFaqs([data, ...faqs]);
        return { success: true, data };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Failed to create FAQ';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const updateFaq = async (faqId: string, faqData: { question: string; answer: string }) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/kb/faqs/${faqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(faqData)
      });
      
      if (response.ok) {
        const updatedFaq = { ...faqData, id: faqId, created_at: '', updated_at: '' };
        setFaqs(faqs.map(faq => faq.id === faqId ? updatedFaq : faq));
        return { success: true };
      } else {
        const data = await response.json();
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Failed to update FAQ';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const deleteFaq = async (faqId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/kb/faqs/${faqId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setFaqs(faqs.filter(faq => faq.id !== faqId));
        return { success: true };
      } else {
        const data = await response.json();
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Failed to delete FAQ';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (jobId: string, onComplete: (status: string, error?: string) => void) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/kb/jobs/${jobId}`);
        const data = await response.json();
        
        if (response.ok) {
          if (data.status === 'success' || data.status === 'error') {
            clearInterval(interval);
            onComplete(data.status, data.error);
          }
        }
      } catch (err) {
        clearInterval(interval);
        onComplete('error', 'Failed to check job status');
      }
    }, 2000);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    fetchSources();
    fetchFaqs();
  }, []);

  return {
    sources,
    faqs,
    jobs,
    loading,
    error,
    setError,
    fetchSources,
    fetchFaqs,
    createSource,
    startCrawl,
    createFaq,
    updateFaq,
    deleteFaq,
    pollJobStatus,
  };
}
