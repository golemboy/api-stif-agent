'use strict';
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

var rejectedPromise = (error) =>  Promise.reject(new Error(error))
var resolvedPromise = (msg) => Promise.resolve(msg)


// fetch(uri, requestOptions)
//   .then(response => response.text())
//   .then(result => console.log(result))
//   .catch(error => console.log('error', error));

async function claim_token(refresh_token) {
  const uri = 'https://as.api.iledefrance-mobilites.fr/api/oauth/token'

  const oauthPost = {
      grant_type: 'client_credentials',
      scope: 'read-data',
      client_id: 'xxx',
      client_secret: 'xxx',
  }
    
  const urlencoded = new URLSearchParams();
  for(var key in oauthPost)
    urlencoded.append(key, oauthPost[key]);
  
  const headers =  {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': JSON.stringify(oauthPost).length
  }
  
  const requestOptions = {
    method: 'POST',
    headers: headers,
    body: urlencoded,
    redirect: 'follow'
  };

    try {

        const last_token_date = refresh_token.token_date
        const expires_in = refresh_token.expires_in
        const next_token_tick = Math.round((Date.now() - refresh_token.token_date)/1000)
        console.log(next_token_tick)
        let token = refresh_token; // on récupère l'ancien token
        if (next_token_tick >= expires_in) { 
          //maj du token            
          const response = await fetch(uri, requestOptions)
          token = await response.json();
          token.token_date = Date.now();
          //console.log(token);
        }
       
        console.log(token);
        return resolvedPromise(token)
        
    } catch (err) {
        console.error(err);
        return rejectedPromise(err)
    }
} 


async function get_stop_list(line) {
  const uri = 'https://data.iledefrance-mobilites.fr/explore/dataset/liste-arrets-lignes-tc-idf/download/?format=json&disjunctive.route_long_name=true&refine.agency_name=RATP&refine.route_long_name='+line+'&sort=stop_lon&timezone=Europe/Berlin&lang=fr'
  const requestOptions = {
    method: 'GET',
    redirect: 'follow'
  };
  try {
    const response = await fetch(uri, requestOptions)
    const stop_list = await response.json();
    console.log(stop_list)    
    var liste = stop_list.map( stop_item => {
      let item = {}
      item.route_id = 'line:0:'+stop_item.fields.route_id
      item.stop_id = stop_item.fields.stop_id.replace('StopPoint','stop_point:0:SP')
      item.stop_name = stop_item.fields.stop_name
      return item
    })
    //console.log(liste)
    return resolvedPromise(liste)
  }
  catch (err) {
    //console.error(err)
    return rejectedPromise(err)
  }

}

async function get_stop_list_agg(line) {   
  try {
    let stop_list = await get_stop_list(line)
    stop_list.sort( (a,b) => {
      if(a.stop_name > b.stop_name) {
        return 1
      } else if(a.stop_name < b.stop_name) {
        return -1
      } else {
        return 0
      }
    })
    
    let agg_arr = stop_list.reduce( (result, current) =>{
      let cle = current.stop_name;
      if (!(cle in result)) {
        result[cle] = {};
        let arr = []
        arr.push(current.stop_id)
        const item = {
          route_id: current.route_id,
          stop_id: arr,
          stop_name: current.stop_name
        }  
        result[cle] = item       
      } else {       
        result[cle].stop_id.push(current.stop_id)
      }                 
      return result;
    },[])
    //console.log(agg_arr)
    return resolvedPromise(agg_arr)
  }
  catch (err) {
    console.error(err)
    return rejectedPromise(err)
  }
  
}


async function get_departure(stop_point, token) {
  //console.log(stop_point)
  //console.log(token.access_token)
  const uri = 'https://traffic.api.iledefrance-mobilites.fr/v1/tr-vianavigo/departures'

  const headers =  {
    'Authorization': 'Bearer '+token.access_token
  }
  //console.log(headers)

  const requestOptions = {
    method: 'GET',
    redirect: 'follow',
    headers: headers,
  };
  try {
    
    const promises = []
    for (const item of stop_point.stop_id) {
      let url = uri + "?line_id="+stop_point.route_id+"&stop_point_id="+item
      console.log(url)
      promises.push( await fetch(url,requestOptions) )
    }
    Promise.all(
      promises.map( async(response) => {
        const result = await response.json();

        console.log(result)
      })
    )
    

  } catch (error) {
    console.error(err);
    return rejectedPromise(err)
  }
}


const old_token  = 
{
  access_token: 'owvP0rG9kgQr0QghHz1p1BxklNvHLf7Wu2o8geyaZ4TMaMmPJuHi1J',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'read-data',
  token_date: 1601836035497
}
// const stop_point = {
//   route_id: 'line:0:100100058:58',
//   stop_id: [ 'stop_point:0:SP:59:7922556', 'stop_point:0:SP:59:7176238' ],
//   stop_name: 'VAVIN'
// }


async function run() {
  try {
    const token = await claim_token(old_token)
    const stop_points = await get_stop_list_agg('58')
    //const schedule = await get_departure(stop_points["VAVIN"],token)
  } catch (error) {
    
  }
}
//get_stop_list('58')
run() 

