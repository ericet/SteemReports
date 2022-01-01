// Checking if the already exists
async function checkAccountName(username) {
    const [ac] = await steem.api.getAccountsAsync([username]);
    return (ac === undefined) ? false : true;
}


$('#view').submit(async function (e) {
    e.preventDefault();
    const username = $('#username').val().toLowerCase();
    if (username) {
        let isFound = await checkAccountName(username);
        if (isFound) {
            window.location.href = "./report.html?account=" + username;
        }else{
            alert("STEEM ID Not Found!");
            $("#username").focus();
            return;
        }
    } else {
        alert("Please Enter the STEEM ID!");
        $("#username").focus();
        return;
    }
})

