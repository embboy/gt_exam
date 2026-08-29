ALTER TABLE source_import_item
  DROP CONSTRAINT source_import_item_record_type_check;

ALTER TABLE source_import_item
  ADD CONSTRAINT source_import_item_record_type_check
  CHECK (record_type IN ('OCR_COLUMN', 'ANSWER_PAGE', 'LOCAL_PDF_PAGE'));