import express from 'express';
import cors from 'cors';
const app = express();
const port = process.env.PORT || 80;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var whitelist = ['null']
var corsOptions = {
  origin: function (origin: any, callback: any) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

app.use(cors(corsOptions));

import { router as api } from './routes/api';
app.use(api);

app.use((req, res, next) => {
    res.status(404).send({
        message: 'Not Found'
    });
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});