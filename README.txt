Must have node.js installed to be able to initialize script.

To begin, use 

  npm install 

to install the required packages.

Next fill in the amazon API awsId, awsSecret, and awsTag.

Now fill in any markup, exchangeRate, creditCard, shipping info.

BEFORE RUNNING, IF YOU WANT TO READ FROM A FILE OF ASIN's MAKE SURE TO 
POPULATE THE asin.txt FILE WITH THE ASIN VALUES EACH ON A LINE BY ITSELF

Otherwise, you can manually enter asin values, but make sure asin.txt is empty

Not guaranteed to collect info for each asin

Might pause before progress bar hits 100%, check how much products failed against how much left
if the number of failed products is equal to the number of product left to gather then script 
is done and you can force close at that point
