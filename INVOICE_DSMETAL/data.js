// Products dataset
const products = [
    { "title": "Garde corp", "description": "Fabrication sur mesure des garde Corps pour l'escalier en bois, selon conception de l'architecte : Garde Corps principalement en tube d'acier laqué noir satin avec boulon noir, soit en tube rond de diamètre de 30mm, et traversant en tube de 15mm, acier fixation on boulon sur platine préfabrique", "price": 1380 },
    { "title": "Rideau Métallique", "description": "Rideau métallique de haute qualité.", "price": 800 },
    { "title": "Remplacement d'une porte d'entrée", "description": "Remplacement d'une porte d'entrée vitrée aux dimensions sur mesure avec tierce, panneau entièrement vitré et tierce droite intégrée, la porte mesure 2725mm x 1500mm de large, la largeur de la porte principale est de 930mm, la porte est remplissée en verre stadip aux normes 44,2 la vue est externe et l'ouverture est interne la poignée est standard, les parties ouvertes sont peintes en doré, le profile du cadre est en coulure marron, les travaux ménagers comprennent la réparation des murs endommagés", "price": 5989 },
    { "title": "Rideau Métallique", "description": "Rideau métallique de haute qualité.", "price": 800 },
    { "title": "Enseigne", "description": "Changement de l'enseigne en façade et en perpendiculaire", "price": 3890 },
    { "title": "Reparation rideau Métallique", "description": "Réparation en changement un axe du rideau métallique électrique en lame ondulé ou perforé, coulisses a solidifier si nécessaire, joues latéraux compensation par ressorts incorporé dans l'axe motorisé, enroulement compris, pose extérieur, avec coffre de 30, vérifier la système de fermeture, débrayage secours pour ouverture et fermeture manuelle, moteur central, de marque italienne, fixation de coulisse mise en place de l'axe motorisé, et du tabliers, fixation de l'ensemble, programme de fin de course, installation électrique de débrayage", "price": 800 },
    { "title": "Porte d entre vitree", "description": "Changement la porte d'entrée, similaire de porte existante, profilé alu, gamme froide, remplissage de verre de sécurité 44,2, avec une imposte fixe en haut, couleur marron foncé comme existante", "price": 2890 },
    { "title": "Changement d'un portail", "description": "Fabrication sur mesure un portail en tube d'acier et tôle de 2mm, style simple, modifier la hauteur de grille pour que la hauteur de la grille du muret fassent un total de 2m de haut, compléter une partie de grille de même style du 700mm de haut (pique compris) scellement deux poteaux en métal, ferme porte, les pointes de fer forgé en forme de lys sur le longe du clôture et portail sont offert, motif au milieu du portail offert, festonnage compris, portillon ouverture vers l'intérieur contre mur droit (vu devant a extérieur )", "price":5600 },
    { "title": "Ajout d'un pommeau de porte", "description": "Réparation des partie poignée, une serrure en applique installé, et ajout de deux pommeaux de portes en laiton", "price":350 },
    { "title": "Reprise la porte d'entrée en fer", "description": "Reprise la porte d'entrée en fer, poncer, souder et peinture, couleur noir comme existant", "price": 1680 }
];
	
// Clients dataset
const clients = [
    { "name": "Papa Burger", "address": "28 AV DU GENERAL LECLER, 92100, BOULOGNE-BILLANCOURT - France","siren":"917 604 365 00010","tvaIntra":"FR55917604365"},
    { "name": "REFLET IMMOBILIER", "address": "10 RUE IMMEUBLES-INDUSTRIELS, 75011, PARIS 11 - FRA", "siren":"749971982","tvaIntra":"FR85749971982"},
    { "name": "Client C", "address": "789 Boulevard Saint-Germain, Marseille, France" },
    { "name": "Mme Van Strien", "address" : "28 rue André Chenier 92130 Issy les Moulineaux" }
];
// Config dataset
const config = {
        companyName: 'DS METAL',
        companyAddress: '5 Impasse David, 93500 Pantin',
        companyPhone: '+33 6 66 43 36 47',
        companyEmail: 'dsmetal998@gmail.com',
        logoUrl: 'DS.png',
        siret: '81785059700011',
        tvaIntra: 'FR47817850597',
        rib: ' FR94 1744 8000 01PO MKGK PWIG A25',
	bic: ' SFPEFRP2',
        legalInfo: "CONDITIONS : 50% a la signature, 30% avant installation, 20% au fin du chantier. Aucun escompte consenti pour règlement anticipé. En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, à laquelle s'ajoutera une indemnité forfaitaire pour frais de recouvrement de 40€. Garantie généralement 2 ans après livraison. Sauf détérioration par client ou l'autrui",
        
    };