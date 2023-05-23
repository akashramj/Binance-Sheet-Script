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

// const fileName = "xlsx_source_copy.xlsx";
// const fileName = "handle_aggregation.xlsx";
// const fileName = "handle_aggregation.csv";
const fileName = "2022-2023.csv";


const tradeSynonyms = [
  "Buy",
  "Sell",
  "Send",
  "Transaction Buy",
  "Transaction Spend",
  "Transaction Related",
  "Transaction Revenue",
  "Transaction Sold",
];

function parseFileData(path) {
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

function xlsxDateTypeConvertor(xlsxDate) {
  // Convert the float value to a JavaScript Date object
  const date = new Date((xlsxDate - 25569) * 86400 * 1000 - 10000); //minus 10 secs only for csv

  // Format the date to a string in the YYYY-MM-DD format
  const formattedDate = date.getTime();

  return formattedDate.toString();
}

function getCsvData() {
  console.log(`making data format from csv data object`);
  let csvData: dataObjectType[] = [];
  const workbook = parseFileData(fileName);
  fs.writeFileSync("./raw-data.json", JSON.stringify(workbook[0].data));
  console.log("csv length", workbook[0].data.length);
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

      dataObject.timestamp = xlsxDateTypeConvertor(row.UTC_Time);
      dataObject.account = row.Account;
      dataObject.operation = row.Operation;
      if (row.Operation == "Fee") {
        dataObject.fee = {
          symbol: row.Coin,
          quantity: row.Change,
        };
      } else if (row.Change > 0) {
        dataObject.incoming = {
          symbol: row.Coin,
          quantity: row.Change,
        };
      } else {
        dataObject.outgoing = {
          symbol: row.Coin,
          quantity: row.Change,
        };
      }
      csvData.push(dataObject);
    });
  });

  fs.writeFileSync("./csvDataDump.json", JSON.stringify(csvData));

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

  // csvData.forEach((data) => {
  //   const timestamp = data.time;
  //   delete data.time;
  //   //if data already exists for the same timestamp
  //   if (mappedData.has(timestamp)) {
  //     console.log("same timestamp");
  //     const existingData = mappedData.get(timestamp);
  //     console.log("existing data operation", existingData.operation);
  //     console.log("data operation", data.operation);

  //     // if(data.operation === "Fee") {
  //     //   mappedData.set(timestamp, {
  //     //     ...existingData,
  //     //     fee: {
  //     //       symbol: data.fee.symbol,
  //     //       quantity: existingData?.fee?.quantity ?? 0 + data.fee.quantity,
  //     //     }
  //     //   })
  //     // }

  //     if (
  //       existingData.operation === data.operation ||
  //       (existingData.operation === "Trade" &&
  //         tradeSynonyms.includes(data.operation))
  //     ) {
  //       // if operation and timestamp is same => aggregate
  //       console.log("same operation");

  //       if ( data?.incoming) {
  //         mappedData.set(timestamp, {
  //           ...existingData,
  //           ...data,
  //           incoming: {
  //             symbol: data.incoming.symbol,
  //             quantity: data.incoming.quantity + existingData?.incoming?.quantity ?? 0,
  //           },
  //         });
  //         console.log('added', mappedData);
  //         console.log('data quan', data.incoming.quantity);
  //         console.log('existing data quan', existingData.incoming.quantity);
  //         console.log('added quan', data.incoming.quantity + existingData.incoming.quantity);
  //       }
  //       if (data?.outgoing) {
  //         mappedData.set(timestamp, {
  //           ...existingData,
  //           ...data,
  //           outgoing: {
  //             symbol: data.outgoing.symbol,
  //             quantity: data.outgoing.quantity + existingData?.outgoing?.quantity ?? 0,
  //           },
  //         });
  //       }
  //       if (existingData?.fee && data?.fee) {
  //         mappedData.set(timestamp, {
  //           ...existingData,
  //           ...data,
  //           fee: {
  //             symbol: data.fee.symbol,
  //             quantity: data.fee.quantity + existingData.fee.quantity,
  //           },
  //         });
  //       }
  //     } else {
  //     switch (existingData.operation) {
  //       case "Realize profit and loss":
  //         {
  //           if (data.operation === "Realize profit and loss") {
  //           }
  //         }
  //         break;
  //       case "Fee":
  //         {
  //           mappedData.set(timestamp, {
  //             ...existingData,
  //             ...data,
  //             operation: tradeSynonyms.includes(data.operation)
  //               ? "Trade"
  //               : data.operation,
  //           });
  //         }
  //         break;
  //       default:
  //         {
  //           mappedData.set(timestamp, {
  //             ...data,
  //             ...existingData,
  //             operation: tradeSynonyms.includes(existingData.operation)
  //               ? "Trade"
  //               : existingData.operation,
  //           });
  //         }
  //         break;
  //     }
  //     }
  //     // if (existingData.operation === "Fee") {

  //     // } else {

  //     // }
  //     // if (existingData.operation === "Buy") existingData.operation = "Trade";
  //   } else {
  //     mappedData.set(timestamp, {
  //       ...data,
  //       operation: tradeSynonyms.includes(data.operation)
  //         ? "Trade"
  //         : data.operation,
  //     });
  //   }
  // });

  var obj = Object.fromEntries(mappedData);
  var jsonString = JSON.stringify(obj);

  fs.writeFileSync("./mapped-data.json", jsonString);
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
//function to merge transactions based on similar timestamp and operations

function mergeTransactions(mappedData: Map<string, any[]>) {
  const newMap = new Map<string, any[]>();
  console.log("merging transactions");

  //loop through each array of each timestamp
  for (const [key, value] of mappedData) {
    const array: newMapType[] = [];
    let isTrade = false;
    // let finalObject: dataObjectType;
    // let operation: string = "";
    value.forEach((dataObject) => {
      // console.log("final object", finalObject);
      console.log("data object", dataObject);
      switch (dataObject.operation) {
        case "Fee":
          {
            // finalObject = {
            //   ...finalObject,
            //   account: dataObject.account,
            //   operation: operation === "" ? "Fee" : operation,
            //   time: key,
            //   fee: {
            //     symbol: dataObject.fee.symbol,
            //     quantity:
            //       dataObject.fee.quantity + (finalObject?.fee?.quantity ?? 0),
            //   },
            // };
            // if (operation === "") operation = "Fee";

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

          isTrade = operation === "Trade";

          // console.log("operation variable", operation);

          if (dataObject?.incoming) {
            //match found = add to array
            // console.log("incoming present");
            // console.log("dataobject qty", dataObject.incoming.quantity);
            // console.log(
            //   "finalobject qty",
            //   finalObject?.incoming?.quantity ?? 0
            // );
            // console.log(
            //   "adding both",
            //   dataObject.incoming.quantity +
            //     (finalObject?.incoming?.quantity ?? 0)
            // );

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

            // finalObject = {
            //   ...finalObject,
            //   account: dataObject.account,
            //   operation: operation,
            //   incoming: {
            //     symbol: dataObject.incoming.symbol,
            //     quantity:
            //       dataObject.incoming.quantity +
            //       (finalObject?.incoming?.quantity ?? 0),
            //   },
            // };
            // console.log("final object appended", finalObject);
          } else if (dataObject?.outgoing) {
            // console.log("incoming present");
            // finalObject = {
            //   ...finalObject,
            //   account: dataObject.account,
            //   operation: operation,
            //   outgoing: {
            //     symbol: dataObject.outgoing.symbol,
            //     quantity:
            //       dataObject.outgoing.quantity +
            //       (finalObject?.outgoing?.quantity ?? 0),
            //   },
            // };
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
    //if operatoin is Trade, merge incoming, outgoing, fee
    const incomingArray = [];
    const outgoingArray = [];
    const feeArray = [];
    array.forEach((obj) => {
      if (obj?.incoming) incomingArray.push(obj);
      else if (obj?.outgoing) outgoingArray.push(obj);
      else feeArray.push(obj);
    });
    console.log("arrays", incomingArray, feeArray, outgoingArray);

    let i = 0,
      j = 0,
      k = 0;
    const inLen = incomingArray.length;
    const outLen = outgoingArray.length;
    const feeLen = feeArray.length;
    let newArray = [];
    //merging incoming, outgoing, fee
    while (i < inLen || j < outLen || k < feeLen) {
      let obj = {};
      let operation = "";
      if (i < inLen) {
        obj = {
          ...obj,
          ...incomingArray[i],
        };
        operation = incomingArray[i].operation;
        i++;
      }
      if (j < outLen) {
        // if (!operation || outgoingArray[j].operation === operation) {
        obj = {
          ...obj,
          ...outgoingArray[j],
        };
        // } else {

        // }
        operation = outgoingArray[j].operation;
        j++;
      }
      if (k < feeLen) {
        obj = {
          ...obj,
          ...feeArray[k],
          operation,
        };
        k++;
      }
      newArray.push(obj);
    }
    // newMap.set(key, finalObject);
    newMap.set(key, newArray);
  }
  const obj = Object.fromEntries(newMap);
  fs.writeFileSync("./new-map.json", JSON.stringify(obj));
  console.log("new map data", newMap);
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
    // const data = {
    //   timestamp: key,
    // };
    // console.log(value.operation);
    console.log("value", value);
    value.forEach((obj) => {
      console.log("obj", obj);
      console.log("obj oreration", obj.operation);
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
        case "Send":
          {
            trade.push({
              ...obj,
              timestamp: key,
              operation: "Funding Fee",
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

  fs.writeFileSync("./final-data.json", JSON.stringify(finalRawData));
  console.log(finalRawData);
}

function main() {
  const csvData = getCsvData();
  const mappedData = mapCsvData(csvData);
  const newMap = mergeTransactions(mappedData);
  // console.log(mappedData);
  const finalRawData = makeFinalRawData(newMap);
  // console.log(finalRawData);
}

main();
