FROM quay.io/qasimtech/Dex-Bot-md:latest

WORKDIR /root/mega-md

RUN git clone https://github.com/Dexsam07/DEX-BOT-MD . && \
    npm install

EXPOSE 5000

CMD ["npm", "start"]
