steem.api.setOptions({ url: 'https://api.campingclub.me' });

let myPosts = [];
function getTransactions(account, start, spv, transactions = new Map(), totalCurationMap = new Map(), totalPayoutMap = new Map(), commentReceived = 0, commentSent = 0) {
  return new Promise((resolve, reject) => {
    let last_trans = start;
    let text = `Loading account history at transaction: <b>` + (start < 0 ? 'latest' : start+'</b>');
    $('#text').html(text);
    let firstDay = new Date(2023,
      0, 1, 1);
    let lastDay = new Date(2024,
      0, 1);
    steem.api.getAccountHistory(account, start, (start < 0) ? 10000 : Math.min(start, 10000), function (err, result) {
      if (err) {
        console.log(`ERROR: Failed loading data for ${account}`);
        alert("出错！请刷新页面!");
        // getTransactions(account, -1, spv);
      }

      result.reverse();

      for (let i = 0; i < result.length; i++) {
        let trans = result[i];
        if (new Date(trans[1].timestamp + "Z") >= firstDay.getTime() && new Date(trans[1].timestamp + "Z") <= lastDay.getTime()) {
          let op = trans[1].op;
          if (op[0] == 'transfer' && op[1].to == account) {
            let amount = op[1].amount.split(' ')[0];
            let currency = op[1].amount.split(' ')[1];
            if (transactions.get('transfer_steem') === undefined || transactions.get('transfer_sbd') === undefined) {
              transactions.set('transfer_steem', 0);
              transactions.set('transfer_sbd', 0);
            }
            if (currency === 'STEEM') {
              transactions.set('transfer_steem', Number(transactions.get('transfer_steem')) + Number(amount));
            } else {
              transactions.set('transfer_sbd', Number(transactions.get('transfer_sbd')) + Number(amount));
            }
          }
          else if (op[0] === 'curation_reward') {
            let curation = Number(op[1].reward.split(" ")[0]) * spv;
            let permlink = op[1].comment_permlink;
            if (totalCurationMap.get(permlink) === undefined) {
              totalCurationMap.set(permlink, curation);
              if (transactions.get('curation_reward') !== undefined) {
                transactions.set('curation_reward', Number(transactions.get('curation_reward')) + curation);
              } else {
                transactions.set('curation_reward', 0);
              }
            }

          } else if (op[0] === 'author_reward') {
            let steemPayout = parseFloat(op[1].steem_payout);
            let sbdPayout = parseFloat(op[1].sbd_payout);
            let spPayout = parseFloat(op[1].vesting_payout) * spv;
            let permlink = op[1].permlink;
            if (totalPayoutMap.get(permlink) === undefined) {
              totalPayoutMap.set(permlink, { 'steem': steemPayout, 'sbd': sbdPayout, 'sp': spPayout });
              transactions.set('author_reward_sp', Number(transactions.get('author_reward_sp') === undefined ? 0 : transactions.get('author_reward_sp')) + spPayout);
              transactions.set('author_reward_steem', Number(transactions.get('author_reward_steem') === undefined ? 0 : transactions.get('author_reward_steem')) + steemPayout);
              transactions.set('author_reward_sbd', Number(transactions.get('author_reward_sbd') === undefined ? 0 : transactions.get('author_reward_sbd')) + sbdPayout);
            }
          } else if (op[0] === 'comment') {
            const isRootPost = !op[1].parent_author;
            if (!isRootPost) {
              if (op[1].author != account) {
                commentReceived++;
              } else {
                commentSent++;
              }
              transactions.set('comment_received', commentReceived);
              transactions.set('comment_sent', commentSent);
            }

          }
        }
        last_trans = trans[0];
      }
      if (last_trans > 0 && last_trans != start && new Date(result[result.length - 1][1].timestamp + "Z") >= firstDay.getTime())
        getTransactions(account, last_trans, spv, transactions, totalCurationMap, totalPayoutMap, commentReceived, commentSent).then(resolve).catch(reject);
      else {
        if (last_trans > 0) {
          console.log('********* Last available transaction was: ' + last_trans + ' ********');
        }
        resolve(transactions);
      }
    });
  });
}
function getFormattedDate(date) {
  var today = new Date(date + "Z");
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  if (dd < 10) {
    dd = '0' + dd;
  }

  if (mm < 10) {
    mm = '0' + mm;
  }
  today = `${mm}/${dd}`;
  return today;
}

function getUserPosts(account, posts = [], start_permlink = '') {
  return new Promise((resolve, reject) => {
    var query = {
      tag: account,
      start_author: account,
      start_permlink,
      limit: 100
    };
    steem.api.getDiscussionsByBlog(query, function (err, discussions) {
      if (!err && discussions) {
        let firstDay = new Date(2022,
          0, 1, 1);
        let lastDay = new Date(2023,
          0, 1);
        if (discussions.length < 100) {
          for (let i in discussions) {
            var data = discussions[i];
            if (posts.length == 0 || posts[posts.length - 1].permlink != data.permlink) {
              posts.push(data);
            }
          }
          resolve(posts)
        } else {
          for (var i in discussions) {
            if (new Date(discussions[i].created + 'Z') >= firstDay.getTime() && new Date(discussions[i].created + 'Z') <= lastDay.getTime() && discussions[i].author == account) {
              var data = discussions[i];
              if (posts.length == 0 || posts[posts.length - 1].permlink != data.permlink) {
                posts.push(data);
              }
            } else if (new Date(discussions[i].created + 'Z') < firstDay.getTime()) {
              resolve(posts);
              return;
            }
          }
          if (new Date(posts[posts.length - 1].created + "Z") >= firstDay.getTime()) {
            getUserPosts(account, posts, posts[posts.length - 1].permlink).then(resolve).catch(reject);
          } else {
            resolve(posts);
          }
        }
      } else {
        console.log("ERROR: " + err);
        alert("出错！请刷新页面!");
        $('#spinner').hide();
      }
    });
  });
}
function getCryptoPriceHistory(symbol) {
  return new Promise(async function (resolve, reject) {
    axios.get(`https://min-api.cryptocompare.com/data/histoday?fsym=${symbol}&tsym=USD&limit=6`).then(function (response, error) {
      if (!error && response.status == 200) {
        let data = response.data;
        resolve(data.Data[data.Data.length - 1].close);
      } else {
        reject('get price error');
      }

    });

  });

}
function calculateUsValue(steem, sbd, sp, sbdPrice, steemPrice) {
  return ((Number(steem) + Number(sp)) * steemPrice + sbd * sbdPrice).toFixed(2);
}

function getReputation(account) {
  return new Promise((resolve, reject) => {
    steem.api.getAccounts([account], function (err, response) {
      resolve(steem.formatter.reputation(response[0].reputation))
    });
  });
}

function getSpv() {
  return new Promise((resolve, reject) => {
    steem.api.getDynamicGlobalProperties(function (err, result) {
      spv = result.total_vesting_fund_steem.replace(" STEEM", "") / result.total_vesting_shares.replace(" VESTS", "");
      resolve(spv);
    });
  });
}
const displayPostsList = (posts) => {
  let display = '';
  posts.forEach(post => {
    display += buildPostsListTemplate(post.root_title, `https://steem.buzz${post.url}`, post.pending_payout_value.split(" ")[0] > 0 ? post.pending_payout_value.split(" ")[0] : (Number(post.total_payout_value.split(" ")[0]) + Number(post.curator_payout_value.split(" ")[0])).toFixed(2), post.created);
  });
  return display;
}
const buildPostsListTemplate = (title, url, payout, date) => {
  let formattedDate = getFormattedDate(date);
  return `
      <tr>
      <td style="text-align:left;width:10%;">
      <div style="color:#4a4a4a;">
      <div style="font-size:12px;">${formattedDate}</div>
        </div>
        </td>
        <td style="text-align:left;width:60%;">
          <a rel="nofollow" target="_blank" href="${url}">
              <div style="color:#4a4a4a;font-size:16px;">${title}</div>
          </a>
        </td>
        <td style="text-align:right;width:20%;">
          <div style="color:#4a4a4a;">
            <div style="font-size:12px;">$${payout}</div>
          </div>
        </td>
      </tr>
  `
}
$(document).ready(async function () {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  let account = urlParams.get('account');
  document.title = `${account}的2022年度小结`;
  let spv = await getSpv();
  $('#spinner').html(`<div class="animationload">
    <div class="osahanloading"></div>
    <div id ="text" class="loadingText">Loading</div>
</div>`);
  Promise.all([getUserPosts(account), getTransactions(account, -1, spv), getReputation(account)]).then(async ([posts, transactions, reputation]) => {
    myPosts = posts;
    let postsCount = posts.length;
    let postsList = displayPostsList(posts);
    let sbdPrice = await getCryptoPriceHistory("SBD");
    let steemPrice = await getCryptoPriceHistory("STEEM");
    let author_reward_sbd = parseFloat(transactions.get('author_reward_sbd')) > 0 ? parseFloat(transactions.get('author_reward_sbd')) : 0;
    let author_reward_sp = parseFloat(transactions.get('author_reward_sp')) > 0 ? parseFloat(transactions.get('author_reward_sp')) : 0;
    let author_reward_steem = parseFloat(transactions.get('author_reward_steem')) > 0 ? parseFloat(transactions.get('author_reward_steem')) : 0;
    let curation_reward = parseFloat(transactions.get('curation_reward')) > 0 ? parseFloat(transactions.get('curation_reward')) : 0;
    let transfer_steem = parseFloat(transactions.get('transfer_steem')) > 0 ? parseFloat(transactions.get('transfer_steem')) : 0;
    let transfer_sbd = parseFloat(transactions.get('transfer_sbd')) > 0 ? parseFloat(transactions.get('transfer_sbd')) : 0;
    let totalSteem = transfer_steem > 0 ? transfer_steem.toFixed(3) : 0;
    let totalSBD = transfer_sbd > 0 ? transfer_sbd.toFixed(3) : 0;
    let totalCuration = curation_reward > 0 ? curation_reward.toFixed(3) : 0;
    let totalPayoutSteem = author_reward_steem > 0 ? author_reward_steem.toFixed(3) : 0;
    let totalPayoutSp = author_reward_sp > 0 ? author_reward_sp.toFixed(3) : 0;
    let totalPayoutSbd = author_reward_sbd > 0 ? author_reward_sbd.toFixed(3) : 0;
    let authorRewardValue = calculateUsValue(author_reward_steem, author_reward_sbd, author_reward_sp, sbdPrice, steemPrice);
    let curationRewardValue = calculateUsValue(0, 0, curation_reward, 0, steemPrice);
    let transferSteemUsdValue = calculateUsValue(transfer_steem, 0, 0, 0, steemPrice);
    let transferSbdUsdValue = calculateUsValue(0, transfer_sbd, 0, sbdPrice, 0);
    let commentReceived = transactions.get('comment_received');
    let commentSent = transactions.get('comment_sent');
    $('#spinner').hide();
    $('#stats').html(`<div>
 <table border="0" cellpadding="0" cellspacing="0" style="margin-left:auto;margin-right:auto" width="100%">
   <tbody>
     <tr>
       <td align="center" valign="top">
         <table width="100%" cellspacing="0" cellpadding="0" class="yiv5089493595100p">
           <tbody>
             <tr>
               <td align="center">
                 <table width="100%" cellspacing="0" cellpadding="0" class="yiv5089493595100p">
                   <tbody>
                     <tr>
                       <td valign="top" class="yiv5089493595100p">
                         <div>
                           <table width="100%" border="0" cellspacing="0" cellpadding="40" class="yiv5089493595100p">
                             <tbody>
                               <tr>
                                 <td align="left" valign="top" style="color:#462814;font-size:18px;">
                                   <font face="&#39;Open Sans&#39;, Arial, sans-serif">
                                     <table width="100%" cellspacing="0" cellpadding="0" class="yiv5089493595100p">
                                       <tbody>
                                         <tr>
                                           <td width="100%" valign="top" class="yiv5089493595100p">
                                             <table width="100%" border="0" cellspacing="0" cellpadding="16">
                                               <tbody>
                                                 <tr>
                                                   <td width="100%">
                                                     <div
                                                       style="background-color:#06d4ac;padding-top:48px;padding-bottom:48px;padding-left:42px;">

                                                       <div
                                                         style="min-height:140px;width:140px;background-repeat:no-repeat;background-position:center center;background-size:contain;text-align:center;">
                                                         <div
                                                           style="width:120px;min-height:120px;border-radius:50%;display:inline-block;margin-top:10px;">

                                                           <img width="110px" height="110px"
                                                             src="https://steemitimages.com/u/${account}/avatar"
      
                                                             style="overflow:hidden;background-color:#fff;border-radius:50%;margin-top:5px;">
                                                         </div>
                                                       </div>

                                                       <font face="'Open Sans', Arial, sans-serif">
                                                         <div
                                                           style="font-size:28px;font-weight:bold;color:#ffffff;margin-top:24px;">
                                                           ${account}
                                                           2022年度STEEM报告
                                                          </div>
                                                       </font>
                                                     </div>

                                                   </td>
                                                 </tr>
                                               </tbody>
                                             </table>
                                           </td>
                                         </tr>
                                       </tbody>
                                     </table>
                                     <table width="100%" border="0" cellspacing="0" cellpadding="16"
                                       class="yiv5089493595100p">
                                       <tbody>
                                         <tr>
                                           <th
                                             style="text-align:center;width:50%;font-size:14px;color:#4a4a4a;margin-bottom:0px;padding-bottom:0px;">
                                             <span> 
                                               你共获得
                                              </span>
                                           </th>
                                         </tr>
                                         <tr>
                                           <td style="text-align:center;padding-top:0px;">
                                             <div style="font-size:40px;min-height:48px;color:#28646e;">
                                               $${authorRewardValue}
                                               <span style="font-size:12px;"> 
                                                 帖子收益
                                                </span>
                                             </div>
                                             <div>
                                               <span style="font-size:12px;color:#9b9b9b;">(${totalPayoutSteem}
                                                 STEEM, ${totalPayoutSbd} SBD, ${totalPayoutSp} SP)</span>
                                             </div>
                                           </td>
                                         </tr>
                                         <tr>
                                           <td style="text-align:center;padding-top:0px;">
                                             <div style="font-size:40px;min-height:48px;color:#28646e;">
                                               $${curationRewardValue}
                                               <span style="font-size:12px;"> 
                                                 审查收益
                                                </span>
                                             </div>
                                             <div>
                                               <span style="font-size:12px;color:#9b9b9b;">(${totalCuration}
                                                 SP)</span>
                                             </div>
                                           </td>
                                         </tr>
                                       </tbody>
                                     </table>
                                     <table width="100%" cellspacing="0" cellpadding="0" class="yiv5089493595100p"
                                       style="margin-top:8px;">
                                       <tbody>
                                         <tr>
                                           <td bgcolor="#f7f7f7" valign="top" class="yiv5089493595100p">
                                             <div>
                                               <table width="100%" border="0" cellspacing="0" cellpadding="40"
                                                 class="yiv5089493595100p">
                                                 <tbody>
                                                   <tr>
                                                     <td align="left" valign="top"
                                                       style="color:#462814;font-size:18px;">
                                                       <font face="&#39;Open Sans&#39;, Arial, sans-serif">
                                                         <p>
                                                           你共收到
                                                          </p>
                                                         <hr
                                                           style="margin-bottom:0px;color:#e6e6e6;border-color:#e6e6e6;border-style:solid;">
                                                         <table width="100%" border="0" cellspacing="0"
                                                           cellpadding="16" class="yiv5089493595100p">
                                                         </table>
                                                         <table width="100%" border="0" cellspacing="0"
                                                           cellpadding="16" class="yiv5089493595100p">
                                                           <tbody>
                                                             <tr>
                                                               <th
                                                                 style="text-align:left;width:50%;font-size:14px;color:#4a4a4a;margin-bottom:0px;padding-bottom:0px;">
                                                                 <span>
                                                                   转账金额
                                                                  </span></th>
                                                               <th
                                                                 style="text-align:left;display:flex;font-size:14px;color:#4a4a4a;margin-bottom:0px;padding-bottom:0px;">
                                                                 <span> </span></th>
                                                             </tr>
                                                             <tr>
                                                               <td style="padding-top:0px;">
                                                                 <div style="color:#28646e;">
                                                                   <div style="font-size:40px;min-height:48px;">
                                                                     ${totalSteem}</div>
                                                                   <div style="font-size:12px;">STEEM</div>
                                                                   <div style="font-size:12px;color:#9b9b9b;">
                                                                     ($${transferSteemUsdValue})</div>
                                                                 </div>
                                                               </td>
                                                               <td
                                                                 style="text-align:left;display:flex;padding-top:0px;">
                                                                 <div style="color:#28646e;margin-right:8px;">
                                                                   <div style="font-size:40px;min-height:48px;">
                                                                     ${totalSBD}</div>
                                                                   <div style="font-size:12px;">SBD</div>
                                                                   <div style="font-size:12px;color:#9b9b9b;">
                                                                     ($${transferSbdUsdValue})</div>
                                                                 </div>
                                                               </td>
                                                             </tr>
                                                           </tbody>
                                                         </table>
                                                         <table width="100%" border="0" cellspacing="0"
                                                           cellpadding="16" class="yiv5089493595100p">
                                                           <tbody>
                                                             <tr>
                                                               <th
                                                                 style="text-align:left;width:50%;font-size:14px;color:#4a4a4a;margin-bottom:0px;padding-bottom:0px;">
                                                                 <span>
                                                                   写了
                                                                  </span></th>
                                                               <th
                                                                 style="text-align:left;display:flex;font-size:14px;color:#4a4a4a;margin-bottom:0px;padding-bottom:0px;">
                                                                 <span> </span></th>
                                                             </tr>
                                                             <tr>
                                                               <td style="padding-top:0px;" >
                                                                 <div style="color:#28646e;">
                                                                   <div style="font-size:40px;min-height:48px;">
                                                                     ${postsCount}篇帖子</div>
                                                                   <div style="font-size:12px;">平均每天${Number(postsCount / 365).toFixed(2)} 篇</div>
                                                                 </div>
                                                               </td>
                                                             </tr>
                                                           </tbody>
                                                         </table>
                                                         <table width="100%" border="0" cellspacing="0"
                                                           cellpadding="16" class="yiv5089493595100p">
                                                           <tbody>
                                                             <tr>
                                                               <th
                                                                 style="text-align:left;width:50%;font-size:14px;color:#4a4a4a;margin-bottom:0px;padding-bottom:0px;">
                                                                 <span>
                                                                   收到
                                                                  </span></th>
                                                               <th
                                                                 style="text-align:left;display:flex;font-size:14px;color:#4a4a4a;margin-bottom:0px;padding-bottom:0px;">
                                                                 <span> </span></th>
                                                             </tr>
                                                             <tr>
                                                               <td style="padding-top:0px;" >
                                                                 <div style="color:#28646e;">
                                                                   <div style="font-size:40px;min-height:48px;">
                                                                     ${commentReceived}条回复</div>
                                                                   <div style="font-size:12px;">平均每天${Number(commentReceived / 365).toFixed(2)}条</div>
                                                                 </div>
                                                               </td>
                                                             </tr>
                                                           </tbody>
                                                         </table>
                                                         <table width="100%" border="0" cellspacing="0"
                                                           cellpadding="16" class="yiv5089493595100p">
                                                           <tbody>
                                                             <tr>
                                                               <th
                                                                 style="text-align:left;width:50%;font-size:14px;color:#4a4a4a;margin-bottom:0px;padding-bottom:0px;">
                                                                 <span>
                                                                   送出
                                                                  </span></th>
                                                               <th
                                                                 style="text-align:left;display:flex;font-size:14px;color:#4a4a4a;margin-bottom:0px;padding-bottom:0px;">
                                                                 <span> </span></th>
                                                             </tr>
                                                             <tr>
                                                               <td style="padding-top:0px;" >
                                                                 <div style="color:#28646e;">
                                                                   <div style="font-size:40px;min-height:48px;">
                                                                     ${commentSent}条评论</div>
                                                                   <div style="font-size:12px;">平均每天${Number(commentSent / 365).toFixed(2)} 条</div>
                                                                 </div>
                                                               </td>
                                                             </tr>
                                                           </tbody>
                                                         </table>
                                                         <div data-html2canvas-ignore="true">
                                                         2022年度所有帖子
                                                         <hr
                                                         style="margin-bottom:0px;color:#e6e6e6;border-color:#e6e6e6;border-style:solid;">
                                                       <table width="100%" border="0" cellspacing="0"
                                                         cellpadding="16" class="yiv5089493595100p">
                                                         ${postsList}
                                                         </table>
                                                </div>
                                                       </font>


                                                     </td>

                                                   </tr>

                                                 </tbody>
                                               </table>
                                              


                                             </div>

                                           </td>

                                         </tr>

                                       </tbody>

                                     </table>

                                    
                                   </font>
                                 </td>
                               </tr>

                             </tbody>

                           </table>
                         </div>
                       </td>
                     </tr>
                   </tbody>
                 </table>
               </td>
             </tr>

           </tbody>
         </table>
       </td>
     </tr>
   </tbody>
 </table>
</div>`);
  }).catch((error) => {
    console.log("ERROR: " + error);
    alert("出错！请刷新页面!");
    $('#spinner').hide();
  });

  $('#shareToSteem').html(`
  <button type="submit" style="margin:0 auto;display:block" class="btn btn-info" data-toggle="modal" data-target="#login">分享到STEEM</button>
`);


});


$('#shareToSteem').submit(async function (e) {
  console.log('Share')
  e.preventDefault();

});


function getImageUrl() {
  return new Promise((resolve, reject) => {
    html2canvas(document.querySelector('#stats')).then(canvas => {
      var options = {
        method: 'POST',
        url: 'https://api.imgur.com/3/image/',
        headers: {
          authorization: 'Client-ID 2667cedc3074464',
        },
        data: { image: canvas.toDataURL().replace(/.*,/, '') },
        dataType: 'json'
      };
      axios.request(options).then(function (response) {
        resolve(response.data.data.link);
      }).catch(function (error) {
        reject(error);
      });
    });
  });
}

async function postToSteem() {
  const steemid = document.getElementById("steemid").value;
  const postingKey = document.getElementById("postingKey").value;
  const title = document.title;
  const tags = "cn,steem2022";
  const tagsList = tags.split(',');
  const url = await getImageUrl();
  const ending = `\n\n---\n想查看自己2022年度STEEM小结？\n链接: https://reports.steem.buzz\n`
  let body = `我的STEEM 2022 \n![](${url})\n## 2022年所有的帖子:\n`;
  for (let post of myPosts) {
    body = body + `* (${getFormattedDate(post.created)}) [${post.title}](https://steem.buzz/@${post.author}/${post.permlink})\n`;
  }
  body += ending;
  let category = tagsList[0];
  const json_metadata = JSON.stringify({ tags: tagsList });
  let permlink = new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
  let beneficiaries = [];
  beneficiaries.push({ account: "steem-drivers", weight: 500 });
  if (window.steem_keychain && postingKey === '') {
    let comment_options = JSON.stringify({
      author: steemid,
      permlink,
      max_accepted_payout: '1000000.000 SBD',
      percent_steem_dollars: 10000,
      allow_votes: true,
      allow_curation_rewards: true,
      extensions: [
        [0, {
          beneficiaries: beneficiaries
        }]
      ]
    });
    steem_keychain.requestPost(steemid, title, body, category, '', json_metadata, permlink, comment_options, function (response) {
      if (response.success) {
        $('#message').html(`<div class="alert alert-success" role="alert">
        Post has been published! <a href="https://steem.buzz/@${steemid}/${permlink}">Click here to view the post</a>
      </div>`);
      } else {
        $('#message').html(`<div class="alert alert-danger" role="alert">
            ${response.message}
          </div>`);
      }
    });
  } else {
    post(title, body, category, tagsList, beneficiaries, steemid, postingKey)
  }
}

function post(title, content, category, tagsList, beneficiaries, author, postingKey) {
  let permlink = new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
  var operations = [
    ['comment',
      {
        parent_author: '',
        parent_permlink: category,
        author: author,
        permlink: permlink,
        title: title,
        body: content,
        json_metadata: JSON.stringify({
          tags: tagsList,
          app: 'steemcn/0.2'
        })
      }
    ],
    ['comment_options', {
      author: author,
      permlink: permlink,
      max_accepted_payout: '100000.000 SBD',
      percent_steem_dollars: 10000,
      allow_votes: true,
      allow_curation_rewards: true,
      extensions: [
        [0, {
          beneficiaries: beneficiaries
        }]
      ]
    }]
  ];
  steem.broadcast.send(
    { operations: operations, extensions: [] },
    { posting: postingKey },
    function (err, result) {
      if (err) {
        $('#message').html(`<div class="alert alert-danger" role="alert">
            ${err}
          </div>`);
      } else {
        $('#message').html(`<div class="alert alert-success" role="alert">
            Post has been published! <a href="https://steem.buzz/@${author}/${permlink}">Click here to view the post</a>
          </div>`);
      }

    });
}
