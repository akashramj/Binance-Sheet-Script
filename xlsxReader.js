const XLSX = require("xlsx");

const parse = (path) => {
  const workbook = XLSX.readFile(path);
  const sheet_name_list = workbook.SheetNames;
  const docs = [];
  sheet_name_list.forEach((sheet) => {
    workbook.Sheets[sheet]["!ref"] = "A1:Z100000";
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);
    docs.push({ name: sheet, data: data });
  });
  return docs;
};

let result = [];

function main() {
  const workbook = parse("./xlsx_source.xlsx");
  workbook.forEach((sheet) => {
    let depositTxns = [];
    sheet.data.forEach((row) => {
      let txnObject = {
        account: null,
        txnType: null,
        incoming: {
          symbol: null,
          quantity: null,
        },
        outgoing: {
          symbol: null,
          quantity: null,
        },
        fee: {
          symbol: null,
          quantity: null,
        },
      };
      //console.log(row)
      depositTxns.push(row);
      txnObject.account = row.Account;
      txnObject.txnType = row.Operation;
      if(row.Operation=="Fee"){
        txnObject.fee.symbol=row.Coin;
        txnObject.fee.quantity=row.Change;
      }
      if (row.Change > 0) {
        txnObject.incoming.symbol = row.Coin;
        txnObject.incoming.quantity = row.Change;
      }
      if (row.Change < 0) {
        txnObject.outgoing.symbol = row.Coin;
        txnObject.outgoing = row.Change;
      }
      result.push(txnObject);
    });
    // console.log(depositTxns);
  });
}

main();

console.log(result);
