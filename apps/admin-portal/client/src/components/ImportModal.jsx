import { useState, useRef, useEffect } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Download, FileText } from 'lucide-react';
import { parseCSVFile, downloadCSV, arrayToCSV } from '../utils/csvExportImport';

/**
 * Reusable Import Modal with Field Mapping
 * @param {Object} props
 * @param {boolean} props.open - Modal open state
 * @param {Function} props.onClose - Close handler
 * @param {string} props.title - Modal title
 * @param {Array} props.fields - Field definitions [{key, label, required, type}]
 * @param {Function} props.onImport - Import handler (data, onProgress) => Promise
 * @param {string} props.templateName - Template filename for download
 */
export default function ImportModal({ open, onClose, title, fields, onImport, templateName, instructions }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(1); // 1: upload, 2: mapping, 3: progress
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importProgress, setImportProgress] = useState(null);
  const [importResults, setImportResults] = useState(null);

  useEffect(() => {
    if (open) {
      // Reset state when modal opens
      setStep(1);
      setFile(null);
      setCsvHeaders([]);
      setCsvData([]);
      setMapping({});
      setImportProgress(null);
      setImportResults(null);
    }
  }, [open]);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(csv|txt)$/i)) {
      alert('Please select a CSV file');
      e.target.value = '';
      return;
    }

    try {
      const { headers, data } = await parseCSVFile(selectedFile);
      setFile(selectedFile);
      setCsvHeaders(headers);
      setCsvData(data);
      
      // Auto-map fields with matching names (case-insensitive)
      const autoMapping = {};
      fields.forEach(field => {
        const matchingHeader = headers.find(h => 
          h.toLowerCase().replace(/[*\s]/g, '') === field.key.toLowerCase().replace(/[*\s]/g, '')
        );
        if (matchingHeader) {
          autoMapping[field.key] = matchingHeader;
        }
      });
      setMapping(autoMapping);
      
      setStep(2);
    } catch (error) {
      alert(`Failed to parse CSV: ${error.message}`);
      e.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const headers = fields.map(f => f.label);
    const exampleRow = fields.map(f => {
      if (f.example !== undefined) return f.example;
      if (f.type === 'boolean') return 'Yes';
      if (f.type === 'number') return '0';
      return 'Example';
    });
    const csv = arrayToCSV(headers, [exampleRow]);
    downloadCSV(`${templateName}_template`, csv);
  };

  const validateMapping = () => {
    const missingRequired = fields
      .filter(f => f.required)
      .filter(f => !mapping[f.key])
      .map(f => f.label);
    
    if (missingRequired.length > 0) {
      alert(`Please map all required fields: ${missingRequired.join(', ')}`);
      return false;
    }
    return true;
  };

  const handleStartImport = async () => {
    if (!validateMapping()) return;
    
    setStep(3);
    setImportProgress({ total: csvData.length, current: 0, errors: [] });
    
    try {
      const results = await onImport(csvData, mapping, (progress) => {
        setImportProgress(progress);
      });
      
      setImportResults(results);
      
      // Generate error file if there are errors
      if (results.errors.length > 0) {
        generateErrorFile(results.errors);
      }
    } catch (error) {
      setImportProgress(prev => ({
        ...prev,
        errors: [...prev.errors, `Import failed: ${error.message}`]
      }));
    }
  };

  const generateErrorFile = (errors) => {
    const headers = ['Row Number', 'Error Message'];
    const rows = errors.map(err => [err.rowIndex + 1, err.message]);
    const csv = arrayToCSV(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${templateName}_errors_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClose = () => {
    if (step === 3 && importProgress && !importResults) {
      if (!confirm('Import is in progress. Are you sure you want to close?')) {
        return;
      }
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (typeof window !== 'undefined' && window.innerWidth >= 640 && e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl border border-gray-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-150 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <Upload size={48} className="mx-auto mb-4 text-brand-orange animate-bounce-slow" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload CSV File
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Select a CSV file to import. You can download a template with the correct format below.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <input
                  type="file"
                  ref={fileRef}
                  onChange={handleFileSelect}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-orange-500/10"
                >
                  <Upload size={20} />
                  Select CSV File
                </button>

                <button
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 border border-gray-300 hover:border-brand-orange text-gray-700 hover:text-brand-orange font-medium px-6 py-3 rounded-xl transition bg-white"
                >
                  <Download size={20} />
                  Download Template
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-250/70 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-600" /> Important Notes:
                </p>
                <ul className="text-xs text-amber-700/95 space-y-1.5 ml-6 list-disc font-medium">
                  {instructions && instructions.length > 0 ? (
                    instructions.map((inst, index) => (
                      <li key={index}>{inst}</li>
                    ))
                  ) : (
                    <>
                      <li>Fields marked with * are required</li>
                      <li>If import fails for some rows, an error file will be downloaded</li>
                      <li>Fix the errors in the error file and re-import only those rows</li>
                      <li>Import will not stop if some rows fail - all valid rows will be imported</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Map Your Fields
                </h3>
                <p className="text-sm text-gray-500">
                  Match your CSV columns to our fields. Required fields are marked with *.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-150 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-600">
                  <FileText size={14} className="inline mr-1 text-gray-400" />
                  File: <span className="font-semibold text-gray-800">{file?.name}</span>
                  <span className="mx-2 text-gray-300">•</span>
                  <span className="font-semibold text-gray-800">{csvData.length}</span> rows detected
                </p>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {fields.map(field => (
                  <div key={field.key} className="grid grid-cols-2 gap-4 items-center border-b border-gray-50 pb-2">
                    <div>
                      <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        {field.label}
                        {field.required && (
                          <span className="bg-red-50 text-red-600 text-xs px-1.5 py-0.5 rounded border border-red-200">
                            Required
                          </span>
                        )}
                      </label>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Type: {field.type}
                      </p>
                    </div>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                      className={`w-full bg-gray-50 border ${
                        field.required && !mapping[field.key] 
                          ? 'border-red-300 focus:ring-red-200' 
                          : 'border-gray-250 focus:ring-orange-200'
                      } text-gray-850 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2`}
                    >
                      <option value="">-- Select Column --</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-3 rounded-xl transition"
                >
                  Back
                </button>
                <button
                  onClick={handleStartImport}
                  className="flex-1 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold px-6 py-3 rounded-xl transition"
                >
                  Start Import
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Progress & Results */}
          {step === 3 && (
            <div className="space-y-6">
              {!importResults ? (
                <>
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-orange border-t-transparent mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Importing...
                    </h3>
                    <p className="text-sm text-gray-500">
                      Processing {importProgress?.current || 0} of {importProgress?.total || 0} rows
                    </p>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-brand-orange h-full transition-all duration-300"
                      style={{
                        width: `${((importProgress?.current || 0) / (importProgress?.total || 1)) * 100}%`
                      }}
                    />
                  </div>

                  {importProgress?.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 max-h-48 overflow-y-auto">
                      <p className="text-sm font-semibold text-red-800 mb-2">
                        Errors encountered (import continues):
                      </p>
                      <ul className="text-xs text-red-750 space-y-1">
                        {importProgress.errors.slice(0, 10).map((err, idx) => (
                          <li key={idx}>Row {err.rowIndex + 1}: {err.message}</li>
                        ))}
                        {importProgress.errors.length > 10 && (
                          <li className="font-semibold text-red-800">
                            ... and {importProgress.errors.length - 10} more errors
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-center">
                    <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Import Complete
                    </h3>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
                      <p className="text-xs text-green-700 mt-1">Successful</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{importResults.errors.length}</p>
                      <p className="text-xs text-red-700 mt-1">Failed</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-700">{importResults.total}</p>
                      <p className="text-xs text-gray-500 mt-1">Total</p>
                    </div>
                  </div>

                  {importResults.errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-600" /> Error File Downloaded
                      </p>
                      <p className="text-xs text-amber-700">
                        A CSV file with the failed rows and error messages has been downloaded. 
                        Fix the errors and re-import only those rows.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleClose}
                    className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-orange-500/10"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
