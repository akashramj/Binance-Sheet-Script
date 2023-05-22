import * as xlsx from "xlsx";
import * as fs from "fs";

interface dataObjectType {
  account: string;
  operation: string;
  time: string;
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

const fileName = 'handle_aggregation.xlsx';

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

function xlsxDateTypeConvertor(xlsxDate) {
  // Convert the float value to a JavaScript Date object
  const date = new Date((xlsxDate - 25569) * 86400 * 1000);

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
        time: "",
        account: "",
        operation: "",
      };
      dataObject.time = xlsxDateTypeConvertor(row.UTC_Time);
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
  let mappedData = new Map();

  csvData.forEach((data) => {
    const timestamp = data.time;
    delete data.time;
    if (mappedData.has(timestamp)) {
      console.log('same timestamp')
      const existingData = mappedData.get(timestamp);
      console.log('existing data operation', existingData.operation);
        console.log('data operation', data.operation);
      if(existingData.operation === data.operation) { // if operation and timestamp is same => aggregate
        console.log('same operation')
        
        if(existingData?.incoming && data?.incoming) {
          mappedData.set(timestamp, {
            ...existingData,
            ...data,
            incoming: {
              symbol: data.incoming.symbol,
              quantity: data.incoming.quantity + existingData.incoming.quantity,
            }
          })
        } else if(existingData?.outgoing && data?.outgoing) {
          mappedData.set(timestamp, {
            ...existingData,
            ...data,
            outgoing: {
              symbol: data.outgoing.symbol,
              quantity: data.outgoing.quantity + existingData.outgoing.quantity,
            }
          })
        } else if(existingData?.fee && data?.fee) {
          mappedData.set(timestamp, {
            ...existingData,
            ...data,
            fee: {
              symbol: data.fee.symbol,
              quantity: data.fee.quantity + existingData.fee.quantity,
            }
          })
        }
      }
      switch(existingData.operation) {
        case "Realize profit and loss": {
          if (data.operation === "Realize profit and loss") {

          }
        }
        break;
        case "Fee": {
          mappedData.set(timestamp, {
            ...existingData,
            ...data,
            operation: tradeSynonyms.includes(data.operation)
              ? "Trade"
              : data.operation,
          });
        }
        break;
        default: {
          mappedData.set(timestamp, {
            ...data,
            ...existingData,
            operation: tradeSynonyms.includes(existingData.operation)
              ? "Trade"
              : existingData.operation,
          });
        }
        break;
      }
      // if (existingData.operation === "Fee") {
       
      // } else {
        
      // }
      // if (existingData.operation === "Buy") existingData.operation = "Trade";
    } else {
      mappedData.set(timestamp, {
        ...data,
        operation: tradeSynonyms.includes(data.operation)
          ? "Trade"
          : data.operation,
      });
    }
  });

  var obj = Object.fromEntries(mappedData);
  var jsonString = JSON.stringify(obj);

  fs.writeFileSync("./mapped-data.json", jsonString);
  return mappedData;
}

function makeFinalRawData(mappedData: Map<string, any>) {
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
  const insuranceFundCompensation = [];
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

  for (const [key, value] of mappedData) {
    const data = {
      timestamp: key,
    };
    // console.log(value.operation);
    switch (value.operation) {
      
      case "Realize profit and loss":
        {
          realizeProfitAndLoss.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Funding Fee":
        {
          fundingFee.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      //------- TRANSFERS ------------
      case "Thirdparty wallet Transfer":
        {
          transfer.push({
            ...value,
            timestamp: key,
            operation: "Transfer",
          });
        }
        break;
      case "transfer_out":
        {
          transfer.push({
            ...value,
            timestamp: key,
            operation: "Transfer",
          });
        }
        break;
      case "transfer_in":
        {
          transfer.push({
            ...value,
            timestamp: key,
            operation: "Transfer",
          });
        }
        break;
      case "Transfer Between Spot Account and UM Futures Account":
        {
          transfer.push({
            ...value,
            timestamp: key,
            operation: "Transfer",
          });
        }
        break;
      case "Main and Funding Account Transfer":
        {
          transfer.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Transfer Between Main Account/Futures and Margin Account":
        {
          transfer.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Asset Conversion Transfer":
        {
          transfer.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      //-------- TRADE ------------
      case "Trade":
        {
          trade.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Send":
        {
          trade.push({
            ...value,
            timestamp: key,
            operation: "Funding Fee",
          });
        }
        break;
      // case "Transaction Spend": {
      //   trade.push({
      //     ...value,
      //     timestamp: key,
      //     operation: "Funding Fee",
      //   })
      // }
      // break;
      // case "Transaction Buy": {
      //   trade.push({
      //     ...value,
      //     timestamp: key,
      //     operation: "Funding Fee",
      //   })
      // }
      // break;
      // case "Transaction Revenue": {
      //   trade.push({
      //     ...value,
      //     timestamp: key,
      //     operation: "Funding Fee",
      //   })
      // }
      // break;
      // case "Transaction Sold": {
      //   trade.push({
      //     ...value,
      //     timestamp: key,
      //     operation: "Funding Fee",
      //   })
      // }
      // break;
      // case "Sell": {
      //   trade.push({
      //     ...value,
      //     timestamp: key,
      //     operation: "Funding Fee",
      //   })
      // }
      // break;
      // case "Buy": {
      //   trade.push({
      //     ...value,
      //     timestamp: key,
      //     operation: "Funding Fee",
      //   })
      // }
      // break;
      case "Distribution":
        {
          distribution.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Commission Rebate":
        {
          commisionRebate.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      // case "IsolatedMargin Repayment": {
      //   isolatedMarginRepayment.push({
      //     ...value,
      //     timestamp: key,
      //   });
      // }
      //break;
      case "Withdraw":
        {
          withdraw.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Deposit":
        {
          deposit.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Insurance Fund Compensation":
        {
          insuranceFundCompensation.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "P2P Trading":
        {
          p2p.push({
            ...value,
            timestamp: key,
            operation: "P2P",
          });
        }
        break;
      // case "IsolatedMargin Loan": {
      //   isol.push({
      //     ...value,
      //     timestamp: key,
      //   });
      // }
      // break;
      // case "BNB Fee Deduction": {
      //   commisionRebate.push({
      //     ...value,
      //     timestamp: key,
      //   });
      // }
      // break;
      // case "IsolatedMargin Liquidation": {
      //   commisionRebate.push({
      //     ...value,
      //     timestamp: key,
      //   });
      // }
      // break;
      case "Leverage Token Redemption":
        {
          leverageTokenRedemption.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Cash Voucher Distribution":
        {
          cashVoucherDistribution.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Leverage Token Purchase":
        {
          leverageTokenPurchase.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Liquid Swap add/sell":
        {
          liquidSwapAddSell.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Liquid Swap rewards":
        {
          liquidSwapRewards.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Liquid Swap remove":
        {
          liquidSwapRemove.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "POS savings purchase":
        {
          posSavingsPurchase.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "POS savings interest":
        {
          posSavingsInterest.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "NFT transaction":
        {
          nftTransaction.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "POS savings redemption":
        {
          posSavingsRedemption.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Large OTC trading":
        {
          largeOtcTrading.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      case "Liquid Swap buy":
        {
          liquidSwapBuy.push({
            ...value,
            timestamp: key,
          });
        }
        break;
      default:
        {
        }
        break;
    }
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
    {
      name: "Insurance Fund Compensation",
      data: insuranceFundCompensation,
    },
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
  // console.log(mappedData);
  const finalRawData = makeFinalRawData(mappedData);
  // console.log(finalRawData);
}

main();
