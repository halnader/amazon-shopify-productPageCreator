//Hashem Alnader April 2018

//PRICE CONVERSION VALUES
const exchangeRate = 0;
const markup = 0;
const creditCard = 0;
const shipping = 0;
const offset = 0;

//DEFAULT TO AUTOMATICALLY PUBLISH
//if FALSE then products once uploaded won't be published
var publish = 'FALSE';

var failCount = 0;

//AMAZON API INITIALIZATION
const amazon = require('amazon-product-api');
const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface( {
	input: process.stdin, 
	output: process.stdout
});

//PROGRESS BAR INITIALIZATION
const _cliProgress = require('cli-progress');
const bar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);

var progress = 0;

//API CALL LIMITER
const RateLimiter = require('limiter').RateLimiter;
var limiter = new RateLimiter(1, 1500);

//AMAZON ID's AND SECRETS
const client = amazon.createClient({
	awsId:"",
	awsSecret:"",
	awsTag:""
});

//products.csv CREATION
if (fs.existsSync('products.csv')) {
	console.log('File exists');
}
else{
	fs.appendFile('products.csv', 'Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare At Price,Variant Requires Shipping,Variant Taxable,Variant Barcode,Image Src,Image Position,Image Alt Text,Gift Card,SEO Title,SEO Description,Google Shopping / Google Product Category,Google Shopping / Gender,Google Shopping / Age Group,Google Shopping / MPN,Google Shopping / AdWords Grouping,Google Shopping / AdWords Labels,Google Shopping / Condition,Google Shopping / Custom Product,Google Shopping / Custom Label 0,Google Shopping / Custom Label 1,Google Shopping / Custom Label 2,Google Shopping / Custom Label 3,Google Shopping / Custom Label 4,Variant Image,Variant Weight Unit,Variant Tax Code\n', function(err){
	if (err) throw err;
		console.log('products.csv written...');
	});

}

process.on('unhandledRejection', (reason, p) => {
	failCount++;
	console.log('a product failed to be collected');
});

//FILE TO READ FROM
const rlf = readline.createInterface({
	input: fs.createReadStream('asin.txt')
});

rlf.on('line', (line) => {
	amazonProducts.push(line);
});

var amazonProducts = [];

//GET PARETNT ASIN FROM THE GIVEN ASIN
let	promiseParent = function(amazonASIN){ 
	return new Promise(function(resolve, reject){
		limiter.removeTokens(1, function() {
			client.itemLookup({
				IdType: 'ASIN',
				ItemId: amazonASIN,
				ResponseGroup: 'ItemIds',
			}).then(function (results){
				var info = JSON.parse(JSON.stringify(results));
				try{
					var parentASIN = info[0].ParentASIN[0];
					
				}
				catch(err){
					console.log('no parent ASIN found in first call');
					parentASIN = info[0].ASIN[0];
				}
				resolve(parentASIN);
				reject('');
			}).catch(function(err) {
				console.log(err.Error[0].Message[0]);
			});
		});
	});	
};

//RUNS THROUGH ALL VARIANTS OF A PRODUCT AND EXTRACTS LONGEST DESCRIPTION
let descripLoop = function(i, variations, promises, contents, maxDescrip, maxIndex){
	let index = i;
	console.log('promise in progress');
	promises.push(new Promise(function(resolve, reject){
		
		console.log(index);
		client.itemLookup({
			IdType: 'ASIN',
			ItemId: variations.Item[index].ASIN[0],
			ResponseGroup: 'EditorialReview',
		}).then(function (results){
			var info = JSON.parse(JSON.stringify(results));
			try{
				contents[i] = info[0].EditorialReviews[0].EditorialReview[0].Content[0];
				if(contents[i].length > maxDescrip.length){
					maxDescrip = contents[i];
					maxIndex = i;
				}

			}	
			catch(err){
				//console.log(err);
				console.log('no description in child %s', i);
			}
			resolve(contents[maxIndex]);	
			reject('No Description');
		}).catch(function(err){
			console.log(err.Error[0].Message[0]);
		});
		
	
	}));
};

//GETS DESCRIPTION, ALSO UTILIZES descripLoop IF NEEDED
let getDescription = function(data, info, varNum, varStatus){
	return new Promise(function(resolve, reject){
		if(varStatus){
			var variations = info[0].Variations[0];
		} else{
			variations = info[0];
		}
		try{
			var descript = info[0].EditorialReviews[0].EditorialReview[0].Content[0];
			console.log('found description in parent');
			data[12] = descript;
			resolve(data);
			reject(data);
		}
		catch(err){
			console.log('did not find description in parent');	
			var promises = new Array(' ');
			var contents = [];
			var maxDescrip = '';
			var maxIndex = 0;
			var counter = 0;
			for(i=0; i<varNum;i++){
				let index = i;
				limiter.removeTokens(1, function() {
					descripLoop(index, variations, promises, contents, maxDescrip, maxIndex);
					if (counter == varNum - 1){
						Promise.all(promises).then(function(result){
							console.log('promise resolved');
							var index = 0;
							for (i=0; i<promises.length; i++){
								if (typeof(result[i]) != 'undefined'){
									index = i;
								}
							}
							descript = result[index];
							data[12] = descript;
							resolve(data);
							reject(data);
						});
					}	
					counter++;
				});
			}
		}	
	});
};

//STARTS THE PROCESS OF COLLECTING ALL VARIOUS BITS OF INFORMATION
let promiseInfo = function(parentASIN){
	return new Promise(function(resolve, reject){
		limiter.removeTokens(1, function(){
			client.itemLookup({
				IdType: 'ASIN',
				ItemId: parentASIN,
				ResponseGroup: 'Variations,ItemAttributes,EditorialReview,Images',
				MerchantId: 'Amazon'
			}).then(function(results){
				var info = JSON.parse(JSON.stringify(results));
				var title = info[0].ItemAttributes[0].Title[0];
				try{
					title = title.split(',').join('-');
				}
				catch(err){
					//console.log(err);
					console.log("couldn't split title");
				}
				var SEOTitle = 'Get ' + title + ' in Canada | Wantboard';
				var SEODescrip = 'Order the ' + title + ' at Wantboard today. Free shipping to anywhere in Canada. No duties or brokerage fees.';
				var handle = title.toLowerCase().split(' ').join('-'); 
				try{
					var brand = info[0].ItemAttributes[0].Brand[0];
				}
				catch(err){
					brand = title.split(' ')[0];
				}
				try{
					var variations = info[0].Variations[0];
					var varStatus = true;
				}
				catch(err){
					console.log('no variants found');
					varStatus = false;
					variations = info[0];
				}
				var varNum = 1;
				if (varStatus){
					varNum = variations.Item.length;
				}
				var content = '';
				var varVal = [''];
				var varImage = [];
				var price = [];
				var indexOfInterest = 0;
				var featureMax = 0;
				var features = 0;
				var variation = ['','',''];
				for (x = 0; x < 3; x++){
					if(varStatus){
						try{
							variation[x] = variations.Item[0].VariationAttributes[0].VariationAttribute[x].Name[0];	
						}
						catch(err){
							console.log("empty variation");
						}
					}
				}
			
				for (i=0; i < varNum; i++){
					if(varStatus){
						features = variations.Item[i].ItemAttributes[0].Feature.length;
						let p = Number((variations.Item[i].Offers[0].Offer[0].OfferListing[0].Price[0].FormattedPrice[0]).replace(/[^0-9\.-]+/g,""));
						if(p * markup/100 < 40){
							price[i] = Math.ceil((p * (1 + markup/100) + shipping) * exchangeRate) - 0.01;
						} else {
							price[i] = Math.ceil(((p * (1 + creditCard/100) + offset) + shipping) * exchangeRate) - 0.01;
						}
						varImage[i] = variations.Item[i].ImageSets[0].ImageSet[0].LargeImage[0].URL[0];
						varVal[i] = variations.Item[i].VariationAttributes[0].VariationAttribute[0].Value[0];
			
						for (j=1; j < 3; j++){
							try{
								value = variations.Item[i].VariationAttributes[0].VariationAttribute[j].Value[0];	
							}
							catch(err){
								value = '';
							}
							varVal[i] = varVal[i] + '\\' + value;
						}

						if (features > featureMax){
							featureMax = features;
							indexOfInterest = i;
						}
					}
					else{
						try{
							features = variations.ItemAttributes[0].Feature.length;
						}
						catch(err){
							console.log('no specs');
							features = 'No specs';
						}
						try{
							let p = Number((variations.ItemAttributes[0].ListPrice[0].FormattedPrice[0]).replace(/[^0-9\.-]+/g,""));
							if(p * markup/100 < 40){
								price[i] = Math.ceil((p * (1 + markup/100) + shipping) * exchangeRate) - 0.01;
							} else {
								price[i] = Math.ceil(((p * (1 + creditCard/100) + offset) + shipping) * exchangeRate) - 0.01;
							}
						}
						catch(err){
							console.log('no price found');
							price[i] = '0';
						}
						try{
							varImage[i] = variations.LargeImage[0]. URL[0];
						}
						catch(err){
							varImage[i] = '';
							console.log('no image')
						}
					}
				}	
				var specs;
				if (varStatus){
					try{
						specs = variations.Item[indexOfInterest].ItemAttributes[0].Feature;
					}
					catch(err){
						specs = '';
					}
				}
				else{
					try{
						specs = variations.ItemAttributes[0].Feature;
					}
					catch(err){
						specs = '';
					}
				}
				if(typeof(specs) == 'undefined'){
					specs = '';	
				}
				else{
					for (y = 0; y < specs.length; y++){
						specs[y] = '<br>' + specs[y].split(',').join('-') + '</br>';
					}
					specs = specs.join(' ');
				}
				var data = [varNum, specs, varStatus, handle, title, brand, variation, SEOTitle, SEODescrip, varImage, price, varVal, '', info, varStatus]
				resolve(data);
				reject(data);

			}).catch(function(err){
				console.log(err);
			});
		});
	});
};


//WAITS FOR KEYWORD exit BEFORE STARTING THE PROCESS
rl.setPrompt("Enter the amazon product ASIN ('exit' to leave)\n");

rl.prompt();

rl.on('line',function(asin){
  if (asin === 'exit'){
    rl.close();
  }else {
    amazonProducts.push(asin);
  }
});

rl.on('close',function(){
	bar.start(amazonProducts.length, 0);
	for(h=0;h<amazonProducts.length;h++){
		promiseParent(amazonProducts[h]).then(function(parentASIN){
			return promiseInfo(parentASIN);
		}).then(function(data){
			var info = data[13];
			var varNum = data[0];
			var varStatus = data[14]; 
			return getDescription(data, info, varNum, varStatus);
		}).then(function(data){
			var varNum = data[0];
			var specs = data[1];
			var varStatus = data[2];
			var handle = data[3];
			var title = data[4];
			var brand = data[5];
			var variation = data[6];
			var SEOTitle = data[7];
			var SEODescrip = data[8];
			var varImage = data[9];
			var price = data[10];
			var varVal = data[11];
			var descript = data[12];
			try {
				descript = String(descript).split(',').join('-');
			}
			catch(err){
				descript = "No Description";
				console.log("couldn't split description");
			}
			descript = descript + '[[TABS]][[start specs]]'+ specs +'[[end specs]]';
			for(j=0; j < varNum; j++){
				var varValue;
				if (varStatus){
					varValue = varVal[j].split('\\');
				}
				else{
					varValue = ['', '', ''];
				}
				if (j === 0){
					var header = handle+','+title+','+descript+','+brand+',,,'+publish+','+variation[0]+','+varValue[0]+','+variation[1]+','+varValue[1]+','+variation[2]+','+varValue[2]+',,,,0,deny,manual,'+price[j]+',,TRUE,TRUE,,,,,FALSE,'+SEOTitle+','+SEODescrip+',,,,,,,,,,,,,,'+varImage[0]+',lb,,' + '\n';
					fs.appendFile('products.csv',header , function(err){
						if (err) throw err;
					});
					progress++;
					bar.increment(1);
					console.log('\n');
					console.log('fail count: %s', failCount);
					console.log('item header');
				}
				else{
					var sub = handle+',,,,,,,,'+varValue[0]+',,'+varValue[1]+',,'+varValue[2]+',,,,0,deny,manual,'+price[j]+',,TRUE,TRUE,,,,,FALSE,,,,,,,,,,,,,,,,'+varImage[j]+',lb,,' + '\n';
					fs.appendFile('products.csv',sub , function(err){
						if (err) throw err;
					});
					console.log('subhead' + j);
				}
			}	
			setTimeout(function(){
				if(failCount + progress == amazonProducts.length){
					process.exit(0);
				}
			}, 2000);
		}).catch(function(err){
			console.log(err);
		});
		
	}	
});