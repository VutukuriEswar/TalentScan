import React, { useState } from 'react';
import { exportShortlist } from '../api';
import toast from 'react-hot-toast';

function ExportButtons({ jdId, minScore = 0 }) {
  const [loading, setLoading] = useState(false);

  const handleCSV = async () => {
    setLoading(true);
    try {
      const res = await exportShortlist(jdId, minScore);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `talentscan_shortlist_${jdId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported!');
    } catch (e) {
      toast.error('Export failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        id="export-csv-btn"
        className="btn btn-secondary btn-sm"
        onClick={handleCSV}
        disabled={loading || !jdId}
      >
        {loading ? '⟳' : '📥'} Export CSV
      </button>
      <button
        id="export-print-btn"
        className="btn btn-secondary btn-sm"
        onClick={handlePrint}
      >
        🖨️ Print
      </button>
    </div>
  );
}

export default ExportButtons;
