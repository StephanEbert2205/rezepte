import { useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Link2, Loader2, CheckCircle, AlertCircle, Plus, Trash2, PenLine,
  Camera, Sparkles, ImageOff,
} from 'lucide-react';
import { recipeApi, CreateRecipeData, CreateIngredient, PrefilledData } from '../api/client';

type Tab = 'url' | 'manual' | 'photo';

/** Foto-Erkennung via Google Gemini Vision. */
const PHOTO_ENABLED = true;

// ─────────────────────────────────────────────────────────────────────────────
// URL-Import
// ─────────────────────────────────────────────────────────────────────────────

type UrlStatus = 'idle' | 'loading' | 'success' | 'duplicate' | 'error';

function UrlImport({ initialUrl }: { initialUrl?: string }) {
  const navigate = useNavigate();
  const [url, setUrl]           = useState(initialUrl ?? '');
  const [status, setStatus]     = useState<UrlStatus>('idle');
  const [message, setMessage]   = useState('');
  const [recipeId, setRecipeId] = useState<number | null>(null);

  /** Gemeinsame Import-Logik (manuell + auto). */
  const doImport = async (target: string) => {
    setStatus('loading');
    setMessage('');
    try {
      const result = await recipeApi.import(target.trim());
      setRecipeId(result.id);
      setStatus('success');
    } catch (err: unknown) {
      const ax = err as { response?: { status: number; data?: { error?: string; existingId?: number } } };
      if (ax.response?.status === 409) {
        setStatus('duplicate');
        setRecipeId(ax.response.data?.existingId ?? null);
        setMessage('Dieses Rezept ist bereits in deiner Sammlung.');
      } else {
        setStatus('error');
        setMessage(ax.response?.data?.error ?? 'Import fehlgeschlagen. Bitte URL prüfen.');
      }
    }
  };

  /** Auto-Import beim Öffnen über die Teilen-Funktion. */
  useEffect(() => {
    if (initialUrl?.startsWith('http')) {
      doImport(initialUrl);
    }
  }, [initialUrl]); // initialUrl ändert sich nach Mount nicht mehr

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await doImport(url.trim());
  };

  const reset = () => { setUrl(''); setStatus('idle'); setMessage(''); setRecipeId(null); };

  return (
    <>
      {(status === 'idle' || status === 'loading' || status === 'error') && (
        <form onSubmit={handleSubmit} className="card p-6">
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            Rezept-URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="url" type="url" value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.chefkoch.de/rezepte/..."
                className="input pl-9" disabled={status === 'loading'} required
              />
            </div>
            <button type="submit" disabled={status === 'loading' || !url.trim()} className="btn-primary shrink-0">
              {status === 'loading'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importiere…</>
                : 'Importieren'}
            </button>
          </div>

          {status === 'error' && message && (
            <div className="mt-3 flex items-start gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{message}</span>
            </div>
          )}

          <div className="mt-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Unterstützte Quellen</p>
            <div className="grid grid-cols-2 gap-2">
              {['Chefkoch', 'GuteKüche', 'BBC Good Food', 'Allrecipes', 'Essen & Trinken', 'Küchengötter'].map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />{s}
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />Alle Seiten mit Schema.org
              </div>
            </div>
          </div>
        </form>
      )}

      {(status === 'success' || status === 'duplicate') && (
        <div className="card p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className={`w-6 h-6 shrink-0 ${status === 'success' ? 'text-green-500' : 'text-yellow-500'}`} />
            <div>
              <p className="font-medium text-gray-900">
                {status === 'success' ? 'Erfolgreich importiert!' : 'Bereits vorhanden'}
              </p>
              {message && <p className="text-sm text-gray-500 mt-1">{message}</p>}
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            {recipeId && (
              <button onClick={() => navigate(`/rezepte/${recipeId}`)} className="btn-primary">
                Rezept ansehen
              </button>
            )}
            <button onClick={reset} className="btn-secondary">Weiteres importieren</button>
          </div>
        </div>
      )}

      <div className="mt-8 card p-5 bg-brand-50 border-brand-100">
        <p className="text-sm font-medium text-brand-800 mb-1">Hinweis</p>
        <p className="text-sm text-brand-700">
          Der Import funktioniert am besten mit Seiten, die strukturierte Rezeptdaten (Schema.org)
          verwenden. Die meisten bekannten Rezeptseiten unterstützen dies.
        </p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Foto-Erkennung
// ─────────────────────────────────────────────────────────────────────────────

/** Bild im Browser verkleinern (max. 1400px) bevor es hochgeladen wird. */
async function resizeImage(file: File, maxPx = 1400): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else                  { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.88);
    };
    img.src = URL.createObjectURL(file);
  });
}

interface PhotoEntryProps {
  onExtracted: (data: PrefilledData) => void;
}

function PhotoEntry({ onExtracted }: PhotoEntryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [status, setStatus]     = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError]       = useState('');

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus('idle');
    setError('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  };

  const handleRecognize = async () => {
    if (!file) return;
    setStatus('loading');
    setError('');
    try {
      const resized = await resizeImage(file);
      const fd = new FormData();
      fd.append('image', resized, 'photo.jpg');
      const data = await recipeApi.parseImage(fd);
      onExtracted(data);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error ?? 'Erkennung fehlgeschlagen');
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload-Bereich */}
      <div
        onClick={() => !status.includes('loading') && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`relative rounded-xl overflow-hidden cursor-pointer transition-colors ${
          preview ? '' : 'border-2 border-dashed border-gray-200 hover:border-brand-300'
        }`}
      >
        {preview ? (
          <>
            <img src={preview} alt="Vorschau" className="w-full max-h-72 object-cover rounded-xl" />
            <div className="absolute inset-0 flex items-end justify-center pb-4 bg-gradient-to-t from-black/40 to-transparent rounded-xl opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
                Anderes Foto wählen
              </span>
            </div>
          </>
        ) : (
          <div className="p-12 text-center">
            <Camera className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-600 mb-1">Foto aufnehmen oder auswählen</p>
            <p className="text-xs text-gray-400">JPG, PNG, WEBP · max. 5 MB</p>
            <p className="text-xs text-gray-400 mt-1">Oder Bild hierher ziehen</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="sr-only"
        />
      </div>

      {/* Erkennen-Button */}
      {file && (
        <button
          onClick={handleRecognize}
          disabled={status === 'loading'}
          className="btn-primary w-full"
        >
          {status === 'loading' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> KI analysiert das Bild…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Rezept erkennen</>
          )}
        </button>
      )}

      {/* Fehler */}
      {status === 'error' && error && (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3 border border-red-100">
          <ImageOff className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {/* Hinweis */}
      <div className="card p-5 bg-brand-50 border-brand-100">
        <p className="text-sm font-medium text-brand-800 mb-1">Tipps für bessere Ergebnisse</p>
        <ul className="text-sm text-brand-700 space-y-1 list-disc list-inside">
          <li>Rezept vollständig und scharf im Bild</li>
          <li>Gute Beleuchtung, kein Blitz-Glanz</li>
          <li>Funktioniert mit Buchseiten, Zetteln und Screenshots</li>
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manuelle Eingabe
// ─────────────────────────────────────────────────────────────────────────────

type ManualStatus = 'idle' | 'loading' | 'success' | 'error';

const emptyIng = (): CreateIngredient => ({ name: '', amount: '', unit: '', optional: false, notes: '' });

interface TimeField { label: string; value: string; setter: (v: string) => void; min: number }
interface DietFlag  { label: string; checked: boolean; setter: (v: boolean) => void }

interface ManualEntryProps {
  initialData?: PrefilledData | null;
}

function ManualEntry({ initialData }: ManualEntryProps) {
  const navigate = useNavigate();

  const [title, setTitle]               = useState(initialData?.title ?? '');
  const [description, setDescription]   = useState(initialData?.description ?? '');
  const [imageUrl, setImageUrl]         = useState('');
  const [servings, setServings]         = useState(initialData?.servingsOriginal != null ? String(initialData.servingsOriginal) : '');
  const [prepTime, setPrepTime]         = useState(initialData?.prepTime != null ? String(initialData.prepTime) : '');
  const [cookTime, setCookTime]         = useState(initialData?.cookTime != null ? String(initialData.cookTime) : '');
  const [totalTime, setTotalTime]       = useState(initialData?.totalTime != null ? String(initialData.totalTime) : '');
  const [isVegetarian, setIsVegetarian] = useState(initialData?.isVegetarian ?? false);
  const [isVegan, setIsVegan]           = useState(initialData?.isVegan ?? false);
  const [isGlutenFree, setIsGlutenFree] = useState(initialData?.isGlutenFree ?? false);
  const [isLactoseFree, setIsLactoseFree] = useState(initialData?.isLactoseFree ?? false);
  const [tags, setTags]                 = useState(initialData?.tags?.join(', ') ?? '');
  const [ingredients, setIngredients]   = useState<CreateIngredient[]>(
    initialData?.ingredients?.length ? initialData.ingredients : [emptyIng()]
  );
  const [instructions, setInstructions] = useState<string[]>(
    initialData?.instructions?.length
      ? initialData.instructions.map((i) => i.content)
      : ['']
  );
  const [status, setStatus]   = useState<ManualStatus>('idle');
  const [error, setError]     = useState('');
  const [createdId, setCreatedId] = useState<number | null>(null);

  const reset = () => {
    setTitle(''); setDescription(''); setImageUrl('');
    setServings(''); setPrepTime(''); setCookTime(''); setTotalTime('');
    setIsVegetarian(false); setIsVegan(false); setIsGlutenFree(false); setIsLactoseFree(false);
    setTags(''); setIngredients([emptyIng()]); setInstructions(['']);
    setStatus('idle'); setError(''); setCreatedId(null);
  };

  const updIng = (i: number, k: keyof CreateIngredient, v: string | boolean) =>
    setIngredients((prev) => prev.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setStatus('loading'); setError('');
    try {
      const payload: CreateRecipeData = {
        title: title.trim(),
        ...(description.trim()  && { description:      description.trim() }),
        ...(imageUrl.trim()     && { imageUrl:          imageUrl.trim() }),
        ...(servings  !== '' && +servings  > 0  && { servingsOriginal: +servings }),
        ...(prepTime  !== '' && +prepTime  >= 0 && { prepTime:          +prepTime }),
        ...(cookTime  !== '' && +cookTime  >= 0 && { cookTime:          +cookTime }),
        ...(totalTime !== '' && +totalTime >= 0 && { totalTime:         +totalTime }),
        isVegetarian, isVegan, isGlutenFree, isLactoseFree,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        ingredients: ingredients
          .filter((r) => r.name.trim() !== '')
          .map((r) => ({ name: r.name.trim(), amount: r.amount.trim(), unit: r.unit.trim(), optional: r.optional, notes: r.notes.trim() })),
        instructions: instructions.map((c) => c.trim()).filter(Boolean).map((content) => ({ content })),
      };
      const result = await recipeApi.create(payload);
      setCreatedId(result.id); setStatus('success');
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error ?? 'Fehler beim Speichern');
      setStatus('error');
    }
  };

  if (status === 'success' && createdId !== null) {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-3 mb-6">
          <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
          <div>
            <p className="font-medium text-gray-900">Rezept gespeichert!</p>
            <p className="text-sm text-gray-500 mt-1">Das Rezept wurde erfolgreich angelegt.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate(`/rezepte/${createdId}`)} className="btn-primary">Rezept ansehen</button>
          <button onClick={reset} className="btn-secondary">Weiteres eingeben</button>
        </div>
      </div>
    );
  }

  // Arrays außerhalb von JSX definiert (vermeidet TS-Parsing-Konflikte mit "=> void")
  const timeFields: TimeField[] = [
    { label: 'Portionen',               value: servings,   setter: setServings,   min: 1 },
    { label: 'Vorbereitungszeit (min)', value: prepTime,   setter: setPrepTime,   min: 0 },
    { label: 'Kochzeit (min)',          value: cookTime,   setter: setCookTime,   min: 0 },
    { label: 'Gesamtzeit (min)',        value: totalTime,  setter: setTotalTime,  min: 0 },
  ];
  const dietFlags: DietFlag[] = [
    { label: 'Vegetarisch', checked: isVegetarian, setter: setIsVegetarian },
    { label: 'Vegan',       checked: isVegan,       setter: setIsVegan },
    { label: 'Glutenfrei',  checked: isGlutenFree,  setter: setIsGlutenFree },
    { label: 'Laktosefrei', checked: isLactoseFree, setter: setIsLactoseFree },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Banner wenn Daten vom Foto stammen */}
      {initialData && (
        <div className="flex items-center gap-2.5 text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
          <Sparkles className="w-4 h-4 shrink-0 text-brand-500" />
          <span>Vom Foto erkanntes Rezept – bitte Felder prüfen und bei Bedarf anpassen.</span>
        </div>
      )}

      {/* Grunddaten */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Grunddaten</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titel <span className="text-red-500">*</span>
          </label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="input" placeholder="Rezeptname" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} className="input resize-y" placeholder="Kurze Beschreibung (optional)" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bild-URL</label>
          <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
            className="input" placeholder="https://… (optional)" />
        </div>
      </div>

      {/* Zeiten & Portionen */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Zeiten &amp; Portionen</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {timeFields.map(({ label, value, setter, min }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <input type="number" min={min} value={value}
                onChange={(e) => setter(e.target.value)} className="input" placeholder="–" />
            </div>
          ))}
        </div>
      </div>

      {/* Ernährungsweise */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Ernährungsweise</h2>
        <div className="grid grid-cols-2 gap-2">
          {dietFlags.map(({ label, checked, setter }) => (
            <label key={label}
              className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={checked} onChange={(e) => setter(e.target.checked)}
                className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Tags</h2>
        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
          className="input" placeholder="z.B. schnell, pasta, sommer (kommagetrennt)" />
      </div>

      {/* Zutaten */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Zutaten</h2>
        <div className="space-y-3">
          {ingredients.map((ing, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex gap-2 items-center">
                <input type="text" value={ing.amount} onChange={(e) => updIng(i, 'amount', e.target.value)}
                  className="input w-16 text-center" placeholder="Menge" title="Menge" />
                <input type="text" value={ing.unit} onChange={(e) => updIng(i, 'unit', e.target.value)}
                  className="input w-16" placeholder="Einh." title="Einheit" />
                <input type="text" value={ing.name} onChange={(e) => updIng(i, 'name', e.target.value)}
                  className="input flex-1" placeholder="Zutat" title="Zutat" />
                <button type="button" onClick={() => setIngredients((p) => p.filter((_, j) => j !== i))}
                  disabled={ingredients.length === 1}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0 disabled:opacity-30"
                  title="Zeile entfernen">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-3 pl-1 items-center">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer shrink-0">
                  <input type="checkbox" checked={ing.optional}
                    onChange={(e) => updIng(i, 'optional', e.target.checked)}
                    className="rounded border-gray-300 text-brand-500 focus:ring-brand-400 w-3 h-3" />
                  Optional
                </label>
                <input type="text" value={ing.notes} onChange={(e) => updIng(i, 'notes', e.target.value)}
                  className="input flex-1 text-xs"
                  placeholder='Hinweis (optional, z.B. "fein gehackt")' />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setIngredients((p) => [...p, emptyIng()])}
          className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
          <Plus className="w-4 h-4" /> Zutat hinzufügen
        </button>
      </div>

      {/* Zubereitung */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Zubereitung</h2>
        <div className="space-y-2">
          {instructions.map((content, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0 mt-2">
                {i + 1}
              </span>
              <textarea value={content}
                onChange={(e) => setInstructions((p) => p.map((c, j) => (j === i ? e.target.value : c)))}
                rows={2} className="input flex-1 resize-y" placeholder={`Schritt ${i + 1}…`} />
              <button type="button"
                onClick={() => setInstructions((p) => p.filter((_, j) => j !== i))}
                disabled={instructions.length === 1}
                className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-2 disabled:opacity-30"
                title="Schritt entfernen">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setInstructions((p) => [...p, ''])}
          className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
          <Plus className="w-4 h-4" /> Schritt hinzufügen
        </button>
      </div>

      {status === 'error' && error && (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3 border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      <button type="submit" disabled={!title.trim() || status === 'loading'} className="btn-primary w-full">
        {status === 'loading'
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichert…</>
          : 'Rezept speichern'}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Haupt-Seite
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  // Web Share Target: Browser übergibt URL als ?url= oder als Fallback ?text=
  const [searchParams] = useSearchParams();
  const rawShared = searchParams.get('url') || searchParams.get('text') || '';
  const sharedUrl = rawShared.trim().startsWith('http') ? rawShared.trim() : '';

  const [tab, setTab]         = useState<Tab>(sharedUrl ? 'url' : 'url');
  const [prefill, setPrefill] = useState<PrefilledData | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);

  const handleExtracted = (data: PrefilledData) => {
    setPrefill(data);
    setPrefillKey((k) => k + 1);   // ManualEntry neu mounten mit den neuen Daten
    setTab('manual');
  };

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'url',    icon: Link2,    label: 'Per URL importieren' },
    ...(PHOTO_ENABLED ? [{ id: 'photo' as Tab, icon: Camera,  label: 'Foto' }] : []),
    { id: 'manual', icon: PenLine,  label: 'Manuell eingeben' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rezept hinzufügen</h1>
        <p className="mt-1 text-gray-500">Per URL, Foto oder manuelle Eingabe.</p>
      </div>

      {/* Tab-Switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'url'    && <UrlImport initialUrl={sharedUrl || undefined} />}
      {tab === 'photo'  && PHOTO_ENABLED && <PhotoEntry onExtracted={handleExtracted} />}
      {tab === 'manual' && <ManualEntry key={prefillKey} initialData={prefill} />}
    </div>
  );
}
