import "dotenv/config";

import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

import type { Prisma } from "../generated/prisma/client";
import prisma from "../lib/prisma";

type LocalPdfManifest = {
  year: number;
  exam_no: number;
  stage: number;
  session: number;
  file_name: string;
  relative_path: string;
  sha256: string;
};

type PageRecord = Prisma.InputJsonObject & {
  recordType: "LOCAL_PDF_PAGE";
  year: number;
  examNo: number;
  stage: number;
  session: number;
  sourcePdfPath: string;
  sourcePdfSha256: string;
  page: number;
  sourceText: string;
  extractionMethod: "NATIVE_TEXT" | "OCR_FALLBACK";
};

async function main() {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const manifestPath = process.argv[2] ?? resolve(projectRoot, "data/processed/local-pdf-manifest.json");
  const pagesPath = process.argv[3] ?? resolve(projectRoot, "data/processed/local-pdf-pages.jsonl");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as LocalPdfManifest[];
  const sourceByChecksum = new Map(manifest.map((item) => [item.sha256, item]));
  let imported = 0;

  const input = createInterface({ input: createReadStream(pagesPath, "utf8"), crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as PageRecord;
    const source = sourceByChecksum.get(record.sourcePdfSha256);
    if (!source || source.relative_path !== record.sourcePdfPath || !record.sourceText.trim()) {
      throw new Error(`Unverified local PDF page record: ${record.sourcePdfPath} page ${record.page}`);
    }
    let sourceDocument = await prisma.sourceDocument.findFirst({
      where: { sourceKind: "PAST_EXAM", examYear: source.year, checksumSha256: source.sha256 },
    });
    if (!sourceDocument) {
      sourceDocument = await prisma.sourceDocument.create({
        data: {
          sourceKind: "PAST_EXAM",
          examYear: source.year,
          title: `${source.file_name} (user-provided PDF)`,
          publisher: "User-provided local PDF",
          checksumSha256: source.sha256,
          rightsStatus: "REGISTERED",
          rightsNote: "Original local PDF received without a verified publication URL, license, or official answer key.",
        },
      });
    }
    const sourceItemKey = ["LOCAL_PDF_PAGE", source.sha256, record.page].join(":");
    await prisma.sourceImportItem.upsert({
      where: { sourceDocumentId_sourceItemKey: { sourceDocumentId: sourceDocument.id, sourceItemKey } },
      create: {
        sourceDocumentId: sourceDocument.id,
        sourceItemKey,
        recordType: "LOCAL_PDF_PAGE",
        pageNo: record.page,
        rawText: record.sourceText,
        sourceCoordinates: { sha256: record.sourcePdfSha256, stage: record.stage, session: record.session, extractionMethod: record.extractionMethod },
        payload: record,
        reviewStatus: "NEEDS_REVIEW",
      },
      update: {
        rawText: record.sourceText,
        sourceCoordinates: { sha256: record.sourcePdfSha256, stage: record.stage, session: record.session, extractionMethod: record.extractionMethod },
        payload: record,
        reviewStatus: "NEEDS_REVIEW",
        updatedAt: new Date(),
      },
    });
    imported += 1;
  }
  console.log(`Imported ${imported} local PDF review page record(s)`);
}

main().finally(() => prisma.$disconnect());