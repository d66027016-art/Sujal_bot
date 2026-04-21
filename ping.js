const mc = require('minecraft-protocol');
mc.ping({ host: 'play.khushigaming.com', port: 1241 }, (err, response) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(JSON.stringify(response, null, 2));
});
