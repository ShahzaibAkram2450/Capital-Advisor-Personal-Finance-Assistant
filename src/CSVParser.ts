import { Transaction } from "./types";

interface CSVParseResult {
  transactions: Omit<Transaction, "userId">[];
  addedCount: number;
  duplicateCount: number;
  correctedCount: number;
  errors: string[];
}

/**
 * Parses financial CSV file content.
 * Identifies headers dynamically, handles missing data, odd formats, and detects duplicates.
 */
export function parseFinancialCSV(
  csvText: string,
  existingTransactions: Transaction[]
): CSVParseResult {
  const result: CSVParseResult = {
    transactions: [],
    addedCount: 0,
    duplicateCount: 0,
    correctedCount: 0,
    errors: []
  };

  if (!csvText || !csvText.trim()) {
    result.errors.push("The selected CSV file is empty.");
    return result;
  }

  // Handle line breaks
  const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length < 2) {
    result.errors.push("The file contains insufficient rows. A header row and at least one transaction row are required.");
    return result;
  }

  // Custom regex to split CSV columns respecting quotes (e.g., "Starbucks, Inc")
  function splitCSVRow(row: string): string[] {
    const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || row.split(",");
    return matches.map(val => val.replace(/^["']|["']$/g, "").trim());
  }

  // Parse Header and dynamically map columns
  const headerRow = splitCSVRow(lines[0]);
  
  let dateIdx = -1;
  let amountIdx = -1;
  let merchantIdx = -1;
  let categoryIdx = -1;

  // Search dynamically for columns
  headerRow.forEach((col, idx) => {
    const low = col.toLowerCase();
    if (low.includes("date") || low.includes("time") || low.includes("timestamp")) dateIdx = idx;
    else if (low.includes("amount") || low.includes("value") || low.includes("price") || low.includes("cost")) amountIdx = idx;
    else if (low.includes("merchant") || low.includes("description") || low.includes("payee") || low.includes("name") || low.includes("vendor")) merchantIdx = idx;
    else if (low.includes("category") || low.includes("tag") || low.includes("type")) categoryIdx = idx;
  });

  // Fallbacks for standard indexes if columns are not clearly named (e.g. Date, Merchant, Amount, Category)
  if (dateIdx === -1) dateIdx = 0;
  if (merchantIdx === -1) merchantIdx = headerRow.length > 1 ? 1 : 0;
  if (amountIdx === -1) amountIdx = headerRow.length > 2 ? 2 : 0;
  if (categoryIdx === -1) categoryIdx = headerRow.length > 3 ? 3 : -1;

  // Create active existing signature sets to screen duplicates
  const existingSignatures = new Set(
    existingTransactions.map(t => `${t.date}_${t.merchant.toLowerCase().trim()}_${t.amount.toFixed(2)}`)
  );

  // Parse transaction rows
  for (let i = 1; i < lines.length; i++) {
    const rawRow = lines[i];
    if (rawRow.startsWith(",") || rawRow.replace(/,/g, "").trim() === "") {
      // Skip blank or junk rows
      continue;
    }

    const cols = splitCSVRow(rawRow);
    if (cols.length < Math.max(dateIdx, amountIdx, merchantIdx) + 1) {
      // Row is malformed
      continue;
    }

    let date = cols[dateIdx] || "";
    let merchant = cols[merchantIdx] || "";
    let amountStr = cols[amountIdx] || "";
    let category = categoryIdx !== -1 ? cols[categoryIdx] : "";

    let rowCorrected = false;

    // 1. Clean Date format
    if (!date) {
      date = new Date().toISOString().split("T")[0]; // Use current string representation
      rowCorrected = true;
    } else {
      // Match common date strings or reform to ISO YYYY-MM-DD
      const dateParts = date.split(/[-/]/);
      if (dateParts.length === 3) {
        let year = dateParts[0];
        let month = dateParts[1];
        let day = dateParts[2];
        
        // Handle MM/DD/YYYY format or similar
        if (year.length <= 2 && day.length === 4) {
          const temp = year;
          year = day;
          day = dateParts[1];
          month = temp;
        } else if (year.length <= 2 && day.length <= 2) {
          // Guessing format (e.g. 05-12-26 vs 2026-05-12)
          if (parseInt(year) > 50) year = "19" + year;
          else year = "20" + year;
        }

        // Standardize pad
        month = month.padStart(2, "0");
        day = day.padStart(2, "0");
        date = `${year}-${month}-${day}`;
      } else {
        date = new Date().toISOString().split("T")[0];
        rowCorrected = true;
      }
    }

    // 2. Clear Merchant
    if (!merchant) {
      merchant = "Unknown Merchant";
      rowCorrected = true;
    }

    // 3. Clean Amount numeric
    // strip dollar symbols, commas, quotes
    amountStr = amountStr.replace(/[$\s,"']/g, "");
    let amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      amount = 0.00;
      rowCorrected = true;
    }

    // 4. Standarize Category
    if (!category) {
      category = "Miscellaneous";
      rowCorrected = true;
    } else {
      category = category.trim();
    }

    // Construct unique signature for deduplication
    const signature = `${date}_${merchant.toLowerCase().trim()}_${amount.toFixed(2)}`;

    if (existingSignatures.has(signature)) {
      result.duplicateCount++;
      continue;
    }

    const cleanTransaction: Omit<Transaction, "userId"> = {
      id: `csv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      date,
      amount,
      merchant,
      category,
      source: "CSV Upload",
      createdAt: new Date().toISOString()
    };

    result.transactions.push(cleanTransaction);
    existingSignatures.add(signature);
    result.addedCount++;
    if (rowCorrected) result.correctedCount++;
  }

  return result;
}
