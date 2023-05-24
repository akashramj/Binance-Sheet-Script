import * as xlsx from "xlsx";
import * as fs from "fs";

interface dataObjectType {
  account: string;
  operation: string;
  timestamp: string;
  incoming?: {
    symbol: string;
    quantity: number;
  };
  outgoing?: {
    symbol: string;
    quantity: number;
  };
  fee?: {
    symbol: string;
    quantity: number;
  };
}

const fileName = "2022-2023.csv";
// const fileName = "all-3-combined.xlsx";
// const fileName = "vineet-sid-binance.csv";

const tradeSynonyms = [
  "Buy",
  "Sell",
  "Transaction Buy",
  "Transaction Spend",
  "Transaction Related",
  "Transaction Revenue",
  "Transaction Sold",
];

//! Excluding isolated margin transfers
const transferSynonyms = [
  "transfer_in",
  "transfer_out",
  "Transfer Between Spot Account and UM Futures Account",
];
function parseFileData(path) {
  console.log(`parsing file data`);
  const workbook = xlsx.readFile(path);
  const sheet_name_list = workbook.SheetNames;
  const docs: any[] = [];
  sheet_name_list.forEach((sheet) => {
    workbook.Sheets[sheet]["!ref"] = "A1:Z100000";
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);
    docs.push({ name: sheet, data: data });
  });
  return docs;
}

// MAIN SCRIPT STARTS FROM HERE :

function xlsxDateTypeConvertor(xlsxDate, extension: string) {
  // Convert the float value to a JavaScript Date object
  let date;
  if (extension === "xlsx") date = new Date((xlsxDate - 25569) * 86400 * 1000);
  else {
    let num = (xlsxDate - 25569) * 86400 * 1000 - 10000; //minus 10 secs only for csv
    if (num % 1000 !== 0) num = Math.ceil((num / 1000) * 1000);
    date = new Date(num);
  }

  //for csv, date format in the file should be => YYYY-MM-DD hh:mm:ss

  //getting unix timestamp
  let formattedDate = date.getTime();

  if (formattedDate % 10 !== 0) formattedDate -= 1; //for csv

  return formattedDate.toString();
}

function getCsvData() {
  console.log(`making data format from csv data object`);
  const fileExtension = fileName.split(".").pop();
  console.log({ fileExtension });
  let csvData: dataObjectType[] = [];
  const workbook = parseFileData(fileName);

  // fs.writeFileSync("./raw-data.json", JSON.stringify(workbook[0].data));
  console.log("csv length", workbook[0].data.length);

  //getting data for each row of each worksheet
  workbook.forEach((sheet) => {
    sheet.data.forEach((row) => {
      let dataObject: dataObjectType = {
        timestamp: "",
        account: "",
        operation: "",
      };
      //! IGNORING ISOLATED MARGIN TXNS
      if (dataObject.account === "IsolatedMargin") return;

      //! IGNORING SMALL ASSETS BNB EXCHNAGE TXNS
      if (dataObject.operation === "Small assets exchange BNB") return;

      //converting date into timstamp
      dataObject.timestamp = xlsxDateTypeConvertor(row.UTC_Time, fileExtension);
      dataObject.account = row.Account;
      dataObject.operation = row.Operation;
      if (row.Operation == "Fee") {
        dataObject.fee = {
          symbol: row.Coin,
          quantity: Math.abs(row.Change),
        };
      } else if (row.Change > 0) {
        dataObject.incoming = {
          symbol: row.Coin,
          quantity: Math.abs(row.Change),
        };
      } else {
        dataObject.outgoing = {
          symbol: row.Coin,
          quantity: Math.abs(row.Change), //absolute value
        };
      }
      csvData.push(dataObject);
    });
  });

  // fs.writeFileSync("./csvDataDump.json", JSON.stringify(csvData));

  return csvData;
}

function mapCsvData(csvData: dataObjectType[]) {
  console.log(`mapping data based on timestamp`);
  let mappedData = new Map<string, any[]>();

  csvData.forEach((data) => {
    const timestamp = data.timestamp;
    delete data.timestamp;

    //check whether the map already contains the timestamp
    if (mappedData.has(timestamp)) {
      //push the object into the existing array
      mappedData.set(timestamp, [...mappedData.get(timestamp), data]);
    } else {
      mappedData.set(timestamp, [data]);
    }
  });

  //writing map to json file
  // var obj = Object.fromEntries(mappedData);
  // var jsonString = JSON.stringify(obj);

  // fs.writeFileSync("./mapped-data.json", jsonString);

  return mappedData;
}

interface newMapType {
  timestamp?: string;
  account?: string;
  operation?: string;
  incoming?: {
    symbol: string;
    quantity: number;
  };
  outgoing?: {
    symbol: string;
    quantity: number;
  };
  fee?: {
    symbol: string;
    quantity: number;
  };
}

function getSpotRareTxns(mappedData: Map<string, any[]>) {
  const newRareTxnsMap = new Map<string, any[]>()
  for(const [key, value] of mappedData) {
    let incomingAssets = new Set<string>(); //incoming asset count
    for(const obj of value) {
      if(obj?.incoming && obj?.account === "SPOT") {
        incomingAssets.add(obj?.incoming.symbol);
      }
      if(incomingAssets.size > 1) {
        newRareTxnsMap.set(key, value);
        break;
      }
    }
  }

  let mapObject = Object.fromEntries(newRareTxnsMap);

  fs.writeFileSync(`./rare-spot-txns-${fileName.split('.')[0]}.json`, JSON.stringify(mapObject));
}

//function to merge transactions based on similar timestamp and operations
function mergeTransactions(mappedData: Map<string, any[]>) {
  console.log(`merging common transactions per timestamp`);
  const newMap = new Map<string, any[]>();

  //loop through each array of each timestamp
  for (const [key, value] of mappedData) {
    const array: newMapType[] = [];
    value.forEach((dataObject) => {
      // console.log("data object", dataObject);
      switch (dataObject.operation) {
        case "Fee":
          {
            //look in the array if Fee operation is there with same symbol
            let result = array.findIndex(
              (obj) =>
                obj.operation === "Fee" &&
                obj?.fee.symbol === dataObject.fee.symbol
            );

            if (result !== -1) {
              //match found
              let arrayObject = array[result];

              //add the quantity into previous
              arrayObject = {
                ...arrayObject,
                timestamp: key,
                fee: {
                  symbol: dataObject.fee.symbol,
                  quantity: dataObject.fee.quantity + arrayObject.fee.quantity,
                },
              };

              //update the array object
              array[result] = arrayObject;
            } else {
              array.push(dataObject); //simply push the object
            }
          }
          break;
        default: {
          // console.log("default option", dataObject.operation);
          let operation = tradeSynonyms.includes(dataObject.operation)
            ? "Trade"
            : dataObject.operation;

          if (tradeSynonyms.includes(dataObject.operation)) {
            operation = "Trade";
          } else if (dataObject.operation === "Insurance Fund Compensation") {
            operation = "Realize profit and loss";
          } else {
            operation = dataObject.operation;
          }

          if (dataObject?.incoming) {
            let result = array.findIndex(
              (obj) => obj?.incoming?.symbol === dataObject.incoming.symbol
            );

            if (result !== -1) {
              //match found
              let arrayObject = array[result];

              //add the quantity into previous
              arrayObject = {
                ...arrayObject,
                account: dataObject.account,
                operation: operation,
                timestamp: key,
                incoming: {
                  symbol: dataObject.incoming.symbol,
                  quantity:
                    dataObject.incoming.quantity +
                    arrayObject.incoming.quantity,
                },
              };

              //update the array object
              array[result] = arrayObject;
            } else {
              //simply push the object
              array.push({
                ...dataObject,
                operation: operation, //because operation can be changed, like becoming Trade
              });
            }
          } else if (dataObject?.outgoing) {
            let result = array.findIndex(
              (obj) => obj?.outgoing?.symbol === dataObject.outgoing.symbol
            );

            if (result !== -1) {
              //match found
              let arrayObject = array[result];

              //add the quantity into previous
              arrayObject = {
                ...arrayObject,
                account: dataObject.account,
                operation: operation,
                timestamp: key,
                outgoing: {
                  symbol: dataObject.outgoing.symbol,
                  quantity:
                    dataObject.outgoing.quantity +
                    arrayObject.outgoing.quantity,
                },
              };

              //update the array object
              array[result] = arrayObject;
            } else {
              //simply push the object
              array.push({
                ...dataObject,
                operation: operation, //because operation can be changed, like becoming Trade
              });
            }
          }
          break;
        }
      }
    });
    //if operation is Trade, merge incoming, outgoing, fee
    const incomingArray = [];
    const outgoingArray = [];
    const feeArray = [];

    //populating three arrays for each timestamp
    array.forEach((obj) => {
      if (obj?.incoming) incomingArray.push(obj);
      else if (obj?.outgoing) outgoingArray.push(obj);
      else feeArray.push(obj);
    });

    //pointer indices for arrays
    let i = 0,
      j = 0,
      k = 0;

    //array lengths
    const inLen = incomingArray.length;
    const outLen = outgoingArray.length;
    const feeLen = feeArray.length;

    //populating new Array to be inserted in newMap
    let newArray = [];

    //merging incoming, outgoing, fee
    while (i < inLen || j < outLen || k < feeLen) {
      //! Handling transfer_in, transfer_out, similar
      if (i < inLen && transferSynonyms.includes(incomingArray[i].operation)) {
        newArray.push(incomingArray[i]);
        i++;
        continue;
        //! Handling transfer_in, transfer_out, similar
      } else if (
        j < outLen &&
        transferSynonyms.includes(outgoingArray[j].operation)
      ) {
        newArray.push(outgoingArray[j]);
        j++;
        continue;
      }

      //merge 3 types into one object
      let obj = {};
      let operation = "";
      if (i < inLen) {
        obj = {
          ...obj,
          ...incomingArray[i],
        };
        operation = incomingArray[i].operation;
        i++; //increment pointer
      }
      if (j < outLen) {
        obj = {
          ...obj,
          ...outgoingArray[j],
        };
        operation = outgoingArray[j].operation;
        j++; //increment pointer
      }
      if (k < feeLen) {
        obj = {
          ...obj,
          ...feeArray[k],
          operation,
        };
        k++; //increment pointer
      }
      //add the object into the array
      newArray.push(obj);
    }
    //add the array into the newMap
    newMap.set(key, newArray);
  }

  //writing to file
  // const obj = Object.fromEntries(newMap);
  // fs.writeFileSync("./new-map.json", JSON.stringify(obj));
  // console.log("new map data", newMap);
  return newMap;
}

function makeFinalRawData(newMap: Map<string, any[]>) {
  console.log(`making final raw data`);

  // const thirdPartyWalletTransfer = [];
  const transfer = []; //includes transfer_in and transfer_out, transfer keyword in any case
  const trade = []; // check tradeSynonyms array
  const p2p = [];

  const deposit = [];
  const withdraw = [];

  const payment = [];

  const realizeProfitAndLoss = [];
  const fundingFee = [];
  const distribution = [];
  const commisionRebate = [];
  const cashVoucherDistribution = [];
  const largeOtcTrading = [];
  const nftTransaction = [];

  //asset conversion transfer and transfer between spot and um futures will have same account (USDT Futures) and same opreration (Transfer)
  //TODO : SKIPPING IsolatedMargin as of now

  const leverageTokenRedemption = [];
  const leverageTokenPurchase = [];

  const liquidSwapAddSell = [];
  const liquidSwapRewards = [];
  const liquidSwapRemove = [];
  const liquidSwapBuy = [];

  const posSavingsPurchase = [];
  const posSavingsInterest = [];
  const posSavingsRedemption = [];

  //TODO: need to handle transfers

  let finalRawData = [];

  for (const [key, value] of newMap) {
    value.forEach((obj) => {
      switch (obj.operation) {
        case "Realize profit and loss":
          {
            realizeProfitAndLoss.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Insurance fund compensation":
          {
            realizeProfitAndLoss.push({
              ...obj,
              timestamp: key,
              operation: "Realize profit and loss",
            });
          }
          break;
        case "Funding Fee":
          {
            fundingFee.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        //------- TRANSFERS ------------
        case "Thirdparty wallet Transfer":
          {
            transfer.push({
              ...obj,
              timestamp: key,
              operation: "Transfer",
            });
          }
          break;
        case "transfer_out":
          {
            transfer.push({
              ...obj,
              timestamp: key,
              operation: "Transfer",
            });
          }
          break;
        case "transfer_in":
          {
            transfer.push({
              ...obj,
              timestamp: key,
              operation: "Transfer",
            });
          }
          break;
        case "Transfer Between Spot Account and UM Futures Account":
          {
            transfer.push({
              ...obj,
              timestamp: key,
              operation: "Transfer",
            });
          }
          break;
        case "Main and Funding Account Transfer":
          {
            transfer.push({
              ...obj,
              timestamp: key,
              operation: "Transfer",
            });
          }
          break;
        case "Transfer Between Main Account/Futures and Margin Account":
          {
            transfer.push({
              ...obj,
              timestamp: key,
              operation: "Transfer",
            });
          }
          break;
        case "Asset Conversion Transfer":
          {
            transfer.push({
              ...obj,
              timestamp: key,
              operation: "Transfer",
            });
          }
          break;
        //-------- TRADE ------------
        case "Trade":
          {
            trade.push({
              ...obj,
              timestamp: key,
            });
          }
          break;

        // * handle PAY transactions
        case "Send":
          {
            payment.push({
              ...obj,
              timestamp: key,
              operation: "Payment",
            });
          }
          break;

        // case "Transaction Spend": {
        //   trade.push({
        //     ...obj,
        //     timestamp: key,
        //     operation: "Funding Fee",
        //   })
        // }
        // break;
        // case "Transaction Buy": {
        //   trade.push({
        //     ...obj,
        //     timestamp: key,
        //     operation: "Funding Fee",
        //   })
        // }
        // break;
        // case "Transaction Revenue": {
        //   trade.push({
        //     ...obj,
        //     timestamp: key,
        //     operation: "Funding Fee",
        //   })
        // }
        // break;
        // case "Transaction Sold": {
        //   trade.push({
        //     ...obj,
        //     timestamp: key,
        //     operation: "Funding Fee",
        //   })
        // }
        // break;
        // case "Sell": {
        //   trade.push({
        //     ...obj,
        //     timestamp: key,
        //     operation: "Funding Fee",
        //   })
        // }
        // break;
        // case "Buy": {
        //   trade.push({
        //     ...obj,
        //     timestamp: key,
        //     operation: "Funding Fee",
        //   })
        // }
        // break;
        case "Distribution":
          {
            distribution.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Commission Rebate":
          {
            commisionRebate.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        // case "IsolatedMargin Repayment": {
        //   isolatedMarginRepayment.push({
        //     ...obj,
        //     timestamp: key,
        //   });
        // }
        //break;
        case "Withdraw":
          {
            withdraw.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Deposit":
          {
            deposit.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "P2P Trading":
          {
            p2p.push({
              ...obj,
              timestamp: key,
              operation: "P2P",
            });
          }
          break;
        // case "IsolatedMargin Loan": {
        //   isol.push({
        //     ...obj,
        //     timestamp: key,
        //   });
        // }
        // break;
        // case "BNB Fee Deduction": {
        //   commisionRebate.push({
        //     ...obj,
        //     timestamp: key,
        //   });
        // }
        // break;
        // case "IsolatedMargin Liquidation": {
        //   commisionRebate.push({
        //     ...obj,
        //     timestamp: key,
        //   });
        // }
        // break;
        case "Leverage Token Redemption":
          {
            leverageTokenRedemption.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Cash Voucher Distribution":
          {
            cashVoucherDistribution.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Cash Voucher distribution": {
          cashVoucherDistribution.push({
            ...obj,
            timestamp: key,
          });
        }
        case "Leverage Token Purchase":
          {
            leverageTokenPurchase.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Liquid Swap add/sell":
          {
            liquidSwapAddSell.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Liquid Swap rewards":
          {
            liquidSwapRewards.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Liquid Swap remove":
          {
            liquidSwapRemove.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "POS savings purchase":
          {
            posSavingsPurchase.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "POS savings interest":
          {
            posSavingsInterest.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "NFT transaction":
          {
            nftTransaction.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "POS savings redemption":
          {
            posSavingsRedemption.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Large OTC trading":
          {
            largeOtcTrading.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        case "Liquid Swap buy":
          {
            liquidSwapBuy.push({
              ...obj,
              timestamp: key,
            });
          }
          break;
        default:
          {
          }
          break;
      }
    });
  }

  finalRawData = [
    {
      name: "Transfer",
      data: transfer,
    },
    {
      name: "Trade",
      data: trade,
    },
    {
      name: "Realize profit and loss",
      data: realizeProfitAndLoss,
    },
    {
      name: "Funding Fee",
      data: fundingFee,
    },
    {
      name: "Distribution",
      data: distribution,
    },
    {
      name: "Commission Rebate",
      data: commisionRebate,
    },
    {
      name: "Withdraw",
      data: withdraw,
    },
    {
      name: "Deposit",
      data: deposit,
    },
    // {
    //   name: "Insurance Fund Compensation",
    //   data: insuranceFundCompensation,
    // },
    {
      name: "P2P",
      data: p2p,
    },
    {
      name: "Payment",
      data: payment,
    },
    {
      name: "Leverage Token Redemption",
      data: leverageTokenRedemption,
    },
    {
      name: "Cash Voucher Distribution",
      data: cashVoucherDistribution,
    },
    {
      name: "Leverage Token Purchase",
      data: leverageTokenPurchase,
    },
    {
      name: "Liquid Swap add/sell",
      data: liquidSwapAddSell,
    },
    {
      name: "Liquid Swap rewards",
      data: liquidSwapRewards,
    },
    {
      name: "Liquid Swap remove",
      data: liquidSwapRemove,
    },
    {
      name: "POS savings purchase",
      data: posSavingsPurchase,
    },
    {
      name: "POS savings interest",
      data: posSavingsInterest,
    },
    {
      name: "NFT transaction",
      data: nftTransaction,
    },
    {
      name: "POS savings redemption",
      data: posSavingsRedemption,
    },
    {
      name: "Large OTC trading",
      data: largeOtcTrading,
    },
    {
      name: "Liquid Swap buy",
      data: liquidSwapBuy,
    },
  ];

  fs.writeFileSync(`./final-data-${fileName.split('.')[0]}.json`, JSON.stringify(finalRawData));
  // console.log(finalRawData);
  console.log(`final raw data made successfully`);
  return finalRawData;
}

function main() {
  const csvData = getCsvData();
  const mappedData = mapCsvData(csvData);
  const newMap = mergeTransactions(mappedData);
  const finalRawData = makeFinalRawData(newMap);
  // getSpotRareTxns(mappedData);
}

main();
