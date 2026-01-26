

// Helper to extract text from PDF file object
export const extractPdfText = async (file: File): Promise<string> => {
    try {
        // Dynamic import to avoid SSR/build issues if possible, although this is SPA
        const pdfjsLib = await import('pdfjs-dist')

        // Set worker source - verify path for Vite!
        // Often needs to be copied to public or imported explicitly
        // For Vite, explicit worker import is best
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
        ).toString()

        const arrayBuffer = await file.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdf = await loadingTask.promise

        let textContent = ''
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            const strings = content.items.map((item: any) => item.str)
            textContent += `\n--- Page ${i} ---\n${strings.join(' ')}\n`
        }

        return textContent
    } catch (e) {
        console.error('PDF extraction failed:', e)
        return `[Error extracting PDF content: ${e}]`
    }
}
