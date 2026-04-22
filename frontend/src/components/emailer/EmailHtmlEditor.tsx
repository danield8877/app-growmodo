import { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const formats = ['header', 'bold', 'italic', 'underline', 'list', 'bullet', 'link'];

type Props = {
  subject: string;
  bodyHtml: string;
  onChangeSubject: (v: string) => void;
  onChangeBody: (html: string) => void;
  /** URL publique /revamper/public/:id affichée à titre d’aide */
  demoUrlHint?: string | null;
  disabled?: boolean;
};

export default function EmailHtmlEditor({
  subject,
  bodyHtml,
  onChangeSubject,
  onChangeBody,
  demoUrlHint,
  disabled,
}: Props) {
  const quillClass = useMemo(
    () =>
      'email-html-editor rounded-lg border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-900 [&_.ql-toolbar]:border-gray-200 [&_.ql-toolbar]:bg-gray-50 dark:[&_.ql-toolbar]:border-gray-600 dark:[&_.ql-toolbar]:bg-gray-800 [&_.ql-container]:border-gray-200 dark:[&_.ql-container]:border-gray-600 [&_.ql-editor]:min-h-[220px] [&_.ql-editor]:text-sm dark:[&_.ql-editor]:text-gray-100',
    []
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Objet
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => onChangeSubject(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {demoUrlHint && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
          <span className="font-medium text-primary">Lien de la maquette Revamper : </span>
          <a
            href={demoUrlHint}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline"
          >
            {demoUrlHint}
          </a>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Ce lien est inséré dans l’email (génération IA ou paragraphe automatique). Vous pouvez aussi l’ajouter avec le bouton lien de l’éditeur.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Corps (éditeur)
        </label>
        <div className={quillClass}>
          <ReactQuill
            theme="snow"
            value={bodyHtml}
            onChange={onChangeBody}
            modules={modules}
            formats={formats}
            readOnly={disabled}
            placeholder="Rédigez ou modifiez le contenu HTML…"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Les balises <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{'{{name}}'}</code>,{' '}
        <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{'{{company}}'}</code>,{' '}
        <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{'{{siteUrl}}'}</code>
        {demoUrlHint ? (
          <>
            {' '}
            et <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{'{{previewUrl}}'}</code>
          </>
        ) : null}{' '}
        seront remplacées à l’envoi. Utilisez le bouton lien pour une URL fixe.
      </p>
    </div>
  );
}
