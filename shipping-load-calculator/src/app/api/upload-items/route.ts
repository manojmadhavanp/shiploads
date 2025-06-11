// src/app/api/upload-items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import pdf from 'pdf-parse'; // Correct import for pdf-parse
import { extractItems } from '@/lib/openai';
import { Item } from '@/lib/zodSchemas'; // Import Item type from Zod schemas

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded.' }, { status: 400 });
    }

    const filename = file.name;
    const fileExtension = path.extname(filename).toLowerCase();
    let rawText = '';
    let message = '';
    let operationStatus = 200; // Default OK

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (fileExtension === '.pdf') {
      try {
        const data = await pdf(buffer);
        rawText = data.text;
        message = `Extracted text from PDF: ${filename}. Length: ${rawText.length}. Now sending to AI for item parsing.`;
        if (!rawText.trim()) {
            message = `PDF ${filename} processed, but no text content was extracted. Cannot proceed with AI parsing.`;
            // operationStatus = 400; // Or 200 with empty items if this is not an error itself
        }
      } catch (pdfError: any) {
        console.error(`Error parsing PDF ${filename}:`, pdfError);
        return NextResponse.json({ message: `Failed to parse PDF file: ${pdfError.message}` }, { status: 400 });
      }
    } else if (fileExtension === '.txt' || fileExtension === '.csv') {
      rawText = buffer.toString('utf-8');
      message = `Read text from ${filename}. Length: ${rawText.length}. Now sending to AI for item parsing.`;
      if (!rawText.trim()) {
          message = `Text file ${filename} is empty or contains only whitespace.`;
      }
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        message = `XLSX/XLS file (${filename}) received. Direct text extraction is not robust for these formats. Please convert to CSV or TXT for best results with current setup. AI parsing will be attempted with any available text (might be limited).`;
        // Attempting a naive conversion, likely won't work well for complex Excel files.
        // In a real app, use a library like 'xlsx' to parse sheets to CSV/JSON first.
        rawText = buffer.toString('utf-8'); // This is NOT a proper way to get text from XLSX
        if (!rawText.trim()) {
          message += ' No text could be simply extracted.'
        }
    } else if (['.jpeg', '.jpg', '.png'].includes(fileExtension)) {
      message = `Image file (${filename}) received. Text extraction from images (OCR) is not implemented in this version. AI parsing will not be performed.`;
      // rawText remains empty, extractItems will return []
    } else {
      return NextResponse.json({ message: `File type "${fileExtension}" not supported for text extraction or AI processing.` }, { status: 415 });
    }

    let parsedItems: Item[] = [];
    if (rawText.trim() && operationStatus === 200) { // Only proceed if text was extracted and no prior error
        try {
            parsedItems = await extractItems(rawText);
            if (parsedItems.length > 0) {
                message += ` ${parsedItems.length} items successfully extracted and validated by AI.`;
            } else {
                message += ` AI processing attempted, but no valid items were extracted. This could be due to document format, content, or AI model limitations.`;
                // If extractItems returns [] due to placeholder key, this message will also be shown.
            }
        } catch (error: any) {
            console.error(`Error during AI item extraction for ${filename}:`, error);
            // operationStatus = 500; // Keep 200 to send back potentially partial info from text extraction stage
            message += ` AI processing failed: ${error.message}`; // Append AI error to existing message
        }
    } else if (parsedItems.length === 0 && message.includes("Image file")) {
        // This is an expected path for images, not an error. Message already set.
    } else if (operationStatus === 200 && !rawText.trim() && !message.includes("Image file")) {
        // If no text was extracted from a supported text-based file type (and not an image)
        message = `No text content could be extracted from ${filename} for AI processing.`;
        // operationStatus = 400; // Or keep 200 with empty items
    }

    return NextResponse.json({ message, items: parsedItems }, { status: operationStatus });

  } catch (error) {
    console.error('Upload API Error (Outer Try/Catch):', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error during file upload.';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
