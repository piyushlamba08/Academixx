import io
import pdfplumber
from pypdf import PdfReader
from docx import Document


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """
    Extracts text from a PDF or DOCX file.
    DOCX is preferred — text extraction is 100% reliable.
    PDF works for text-based PDFs only.
    """
    filename_lower = filename.lower()

    if filename_lower.endswith(".docx"):
        return _extract_from_docx(file_bytes)
    elif filename_lower.endswith(".pdf"):
        return _extract_from_pdf(file_bytes)
    else:
        raise ValueError("Only PDF and DOCX files are supported.")


def _extract_from_docx(file_bytes: bytes) -> str:
    try:
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        text = "\n".join(paragraphs)
        if not text:
            raise ValueError("DOCX file is empty or has no readable text.")
        return text
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Failed to read DOCX file: {e}")


def _extract_from_pdf(file_bytes: bytes) -> str:
    extracted_text = ""

    # Primary: pdfplumber
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if len(pdf.pages) > 30:
                raise ValueError("PDF too large — max 30 pages supported.")
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            extracted_text = "\n".join(pages).strip()
    except ValueError:
        raise
    except Exception as e:
        print(f"pdfplumber failed: {e}")
        extracted_text = ""

    # Fallback: pypdf
    if not extracted_text:
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            if len(reader.pages) > 30:
                raise ValueError("PDF too large — max 30 pages supported.")
            pages = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            extracted_text = "\n".join(pages).strip()
        except ValueError:
            raise
        except Exception as e:
            print(f"pypdf failed: {e}")
            extracted_text = ""

    if not extracted_text:
        raise ValueError(
            "Could not extract text from this PDF. "
            "If it's a scanned PDF, please convert it to DOCX first using Microsoft Word."
        )

    return extracted_text
