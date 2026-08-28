import "dotenv/config";

import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

import type { Prisma } from "../generated/prisma/client";
import prisma from "../lib/prisma";

type ManifestItem = {
  article_id: string;
  article_url: string;
  title: string;
  sha256: string;
  relative_path: string;
  license: string;
};

type ImportRecord = Prisma.InputJsonObject & {
  recordType: "OCR_COLUMN" | "ANSWER_PAGE";
  year: number;
  sourceArchiveSha256: string;
  sourcePdfPath: string;
  page: number;
  column?: "LEFT" | "RIGHT";
  pdfClip: number[];
  ocrText: string;
  reviewStatus: "NEEDS_REVIEW";
};

async function main() {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const manifestPath = process.argv[2] ?? resolve(projectRoot, "data/processed/qnet-manifest.json");
  const jsonlPaths = process.argv.length > 3
    ? process.argv.slice(3)
    : [
        resolve(projectRoot, "data/processed/qnet-question-ocr.jsonl"),
        resolve(projectRoot, "data/processed/qnet-answer-ocr.jsonl"),
      ];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestItem[];
  const sourceByChecksum = new Map(manifest.map((item) => [item.sha256, item]));
  let imported = 0;

  for (const jsonlPath of jsonlPaths) {
    const input = createInterface({ input: createReadStream(jsonlPath, "utf8"), crlfDelay: Infinity });
    for await (const line of input) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as ImportRecord;
      const source = sourceByChecksum.get(record.sourceArchiveSha256);
      if (!source || source.license !== "KOGL_TYPE_1") {
        throw new Error(`Verified Q-Net source not found for ${record.sourceArchiveSha256}`);
      }
      let sourceDocument = await prisma.sourceDocument.findFirst({
        where: { sourceKind: "PAST_EXAM", examYear: record.year, checksumSha256: source.sha256 },
      });
      if (!sourceDocument) {
        sourceDocument = await prisma.sourceDocument.create({
          data: {
            sourceKind: "PAST_EXAM",
            examYear: record.year,
            title: source.title,
            sourceUrl: source.article_url,
            publisher: "한국산업인력공단 Q-Net",
            checksumSha256: source.sha256,
            rightsStatus: "RIGHTS_VERIFIED",
            rightsNote: "공공누리 제1유형(출처표시); AI 학습 관련 Q-Net 고지 별도 준수",
            verifiedAt: new Date(),
          },
        });
      }
      const sourceItemKey = [record.recordType, record.sourcePdfPath, record.page, record.column ?? "PAGE"].join(":");
      await prisma.sourceImportItem.upsert({
        where: { sourceDocumentId_sourceItemKey: { sourceDocumentId: sourceDocument.id, sourceItemKey } },
        create: {
          sourceDocumentId: sourceDocument.id,
          sourceItemKey,
          recordType: record.recordType,
          pageNo: record.page,
          pageColumn: record.column,
          rawText: record.ocrText,
          sourceCoordinates: { pdfClip: record.pdfClip },
          payload: record,
          reviewStatus: "NEEDS_REVIEW",
        },
        update: {
          rawText: record.ocrText,
          sourceCoordinates: { pdfClip: record.pdfClip },
          payload: record,
          updatedAt: new Date(),
        },
      });
      imported += 1;
    }
  }

  console.log(`Imported ${imported} Q-Net review records`);
}

main().finally(() => prisma.$disconnect());