const a = {
    account: "Spot",
    operation: "Fee",
    fee: {
        symbol: "ADA",
        quantity: 3.3,
    }
}

const b = {
    account: "Spot",
    operation: "Buy",
    incoming: {
        symbol: "BTC",
        quantity: 1.2,
    }
}

const c = {
    ...a,
    ...b,
}

console.log(c);

function xlsxDateTypeConvertor(xlsxDate) {
    // Convert the float value to a JavaScript Date object
    const date = new Date((xlsxDate - 25569) * 86400 * 1000);
  
    // Format the date to a string in the YYYY-MM-DD format
    const formattedDate = date.getTime();
  
    return formattedDate.toString();
}

const x = xlsxDateTypeConvertor(44725.61880787037);

console.log(x);